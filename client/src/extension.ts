import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ChildProcess } from 'child_process';
import axios from 'axios';
import { InlineDebugAdapterFactory, AlkConfigurationProvider } from './alkDebug';
import { getOptionsString, displayJavaHelp, javaInstalled } from './helpers';
import { readFileSync, writeFileSync } from 'fs';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { isFunction } from 'util';

let client: LanguageClient;

let errorExists = false;

type ErrorDecoration = {
    decoration: vscode.TextEditorDecorationType;
    errorMessages: String[];
};

let errorDecorations: { [id: number]: ErrorDecoration } = {};

function getLineLen(doc: String, index: number): number {
    let lines = doc.split('\n');
    return lines[index].length;
}

function createErrorDecoration(errorMessage: String) {
    return vscode.window.createTextEditorDecorationType({
        backgroundColor: "#A1000066",
        //border: '2px solid white',
        after: {
            contentText: `<--${errorMessage}`,
            textDecoration: "underline",
            margin: "2%"
        }
    });
}

function handleErrors(stdout: String, stderr: String) {
    // console.log(stderr.split('\r\n'));
    if (vscode.window.activeTextEditor) {
        for (let line of [stderr, stdout].join('\n').split('\n')) {
            if (line.match(/Error at \[[0-9]+:[0-9]+\]:/g)) {
                const errorMessage = line.split('Error at [')[1].split(']: ')[1];
                const resCoords = line.split('[')[1].split(']')[0].split(':');
                const lineNum = parseInt(resCoords[0]);
                if (errorDecorations[lineNum]) {
                    errorDecorations[lineNum].errorMessages.push(errorMessage);
                    errorDecorations[lineNum].decoration.dispose();
                    errorDecorations[lineNum].decoration = createErrorDecoration(errorDecorations[lineNum].errorMessages.join(', '));
                }
                else {
                    errorDecorations[lineNum] = {
                        decoration: createErrorDecoration(errorMessage),
                        errorMessages: [errorMessage]
                    };
                }
                errorExists = true;
            }
            else if (line.match(/line [0-9]+:[0-9]+/g)) {
                let resCoords = line.split(' ')[1].split(':');
                const errorMessage = stderr.split(resCoords[1] + '')[1];

                const lineNum = parseInt(resCoords[0]);
                if (errorDecorations[lineNum]) {
                    errorDecorations[lineNum].errorMessages.push(errorMessage);
                    errorDecorations[lineNum].decoration.dispose();
                    errorDecorations[lineNum].decoration = createErrorDecoration(errorDecorations[lineNum].errorMessages.join(', '));
                }
                else {
                    errorDecorations[lineNum] = {
                        decoration: createErrorDecoration(errorMessage),
                        errorMessages: [errorMessage]
                    };
                }
                errorExists = true;
            }
            else {
                console.log(":(");
            }
        }
        for (let key in errorDecorations) {
            const line = parseInt(key);
            let range = new vscode.Range(
                new vscode.Position(line - 1, 0),
                new vscode.Position(line - 1, getLineLen(vscode.window.activeTextEditor.document.getText(), line - 1))
            );
            let decoration = { range };
            vscode.window.activeTextEditor.setDecorations(errorDecorations[line].decoration, [decoration]);
        }
    }
}

function replacePath(path: string) {
    let separator = os.type() === 'Windows_NT' ? '\r\n' : '\n';
    let parts = path.split(separator).filter(p => p !== '');
    parts.shift();
    parts.shift();
    return parts.join(separator);
}

let currentRunningProcess: ChildProcess | null = null;

function runAlkFile(context: vscode.ExtensionContext, alkOutput: vscode.OutputChannel, javaInstalled: boolean, exhaustive = false, symbolic = false) {
    console.log('runAlkFile');
    if (!javaInstalled) {
        displayJavaHelp(alkOutput);
        return;
    }

    if (errorExists) {
        // vscode.window.activeTextEditor?.setDecorations(errorDecoration, []);
        for (let key in errorDecorations) {
            let value = errorDecorations[key];
            value['decoration'].dispose();
            value['errorMessages'] = [];
            delete errorDecorations[key];
        }
        console.log("Cleared");
        errorExists = false;
    }
    const editor = vscode.window.activeTextEditor;
    //var terminal = vscode.window.activeTerminal;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    editor.document.save().then((saved) => {
        if (saved) {
            // Daca pe viitor vrem sa punem optiune de auto-save, tot codul in if-ul asta ar merge pus
            // intr-o functie separata si apelat ori aici, or intr-un if(!opt.autosave)
            const alkRunScript = os.type() === 'Windows_NT' ? 'alki.bat' : 'alki.sh';
            const alkPath = path.join(context.extensionUri.fsPath, 'media', 'alk', alkRunScript);

            const options = getOptionsString(exhaustive, symbolic);

            const filePath = editor.document.uri.fsPath;
            const cp = require('child_process');
            const command = (os.type() === 'Windows_NT' ? '' : '/bin/bash ') + `"${alkPath}" -a "${filePath}" ${options}`;
            if (vscode.workspace.getConfiguration('alk').get('showCommand')) {
                alkOutput.appendLine(command);
            }
            else {
                alkOutput.appendLine(`Running ${filePath}`);
            }

            vscode.commands.executeCommand('setContext', 'alk.canRun', false);
            currentRunningProcess = cp.exec(command, { detached: true }, (err: any, stdout: any, stderr: any) => {
                currentRunningProcess = null;
                vscode.commands.executeCommand('setContext', 'alk.canRun', true);
                if (err) {
                    console.log(`err: ${err}`);
                    return;
                }
                alkOutput.appendLine(os.type() === 'Windows_NT' ? replacePath(stdout) : stdout);
                alkOutput.appendLine(stderr);
                if (stdout || stderr) {
                    handleErrors(stdout, stderr);
                }
                alkOutput.show(true);

                vscode.workspace.onDidChangeTextDocument(_change => {
                    if (_change.document === editor.document) {
                        if (errorExists) {
                            for (let key in errorDecorations) {
                                let value = errorDecorations[key];
                                value['decoration'].dispose();
                                value['errorMessages'] = [];
                                delete errorDecorations[key];
                            }
                            console.log(_change);
                            console.log("Cleared");
                            errorExists = false;
                        }
                    }
                });
            });
        }
        else {
            vscode.window.showErrorMessage('Failed to save document');
            return;
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension active');
    vers(context);
    vscode.commands.executeCommand('setContext', 'alk.canRun', true);
    const alkOutput = vscode.window.createOutputChannel("Alk Output");

    let disposable = vscode.commands.registerCommand('alk.run', () => {
        runAlkFile(context, alkOutput, javaInstalled, false, false);
    });

    let exhaustiveDisposable = vscode.commands.registerCommand('alk.runExhaustive', () => {
        runAlkFile(context, alkOutput, javaInstalled, true, false);
    });

    let debugDisposable = vscode.commands.registerCommand('alk.runDebug', () => {
        vscode.debug.startDebugging(undefined, {
            "type": "alk",
            "request": "launch",
            "name": "Debug Alk",
            "mainFile": "${command:GetActiveFile}"
        });
    });

    let symbolicDisposable = vscode.commands.registerCommand('alk.runSymbolic', () => {
        runAlkFile(context, alkOutput, javaInstalled, false, true);
    });

    let stopDisposable = vscode.commands.registerCommand('alk.stop', () => {
        if (currentRunningProcess) {
            const kill = require('tree-kill');
            alkOutput.appendLine('Stopping Alk');
            kill(currentRunningProcess.pid, (err: any) => {
                if (err) {
                    alkOutput.appendLine(`Error while stopping alk. ${err}`);
                }
                else {
                    alkOutput.appendLine('Alk stopped');
                }
            });
        }
    });

    let optionsDisposable = vscode.commands.registerCommand('alk.options', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:AlkUaic.Alk');
    });

    let getActiveFileDisposable = vscode.commands.registerCommand('alk.getActiveFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return editor.document.uri.fsPath;
        }
        else {
            vscode.window.showErrorMessage('No active editor');
            return 'error';
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(exhaustiveDisposable);
    context.subscriptions.push(symbolicDisposable);
    context.subscriptions.push(debugDisposable);
    context.subscriptions.push(stopDisposable);
    context.subscriptions.push(optionsDisposable);
    context.subscriptions.push(getActiveFileDisposable);
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('alk', new InlineDebugAdapterFactory(context)));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('alk', new AlkConfigurationProvider()));

    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'alk' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    client = new LanguageClient(
        'AlkLangServ',
        'Alk Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
    console.log("Started client");
}

async function vers(context: vscode.ExtensionContext) {
    const alkPath = path.join(context.extensionUri.fsPath, 'media', 'alk');
    const fs = require('fs');
    const fse = require('fs-extra');

    // Check if Alk folder exists
    if (!fs.existsSync(alkPath)) {
        await fse.ensureDir(alkPath);
        console.log("Created Alk folder.");
    }

    const verPath = path.join(alkPath, 'version.txt');
    // Check if version.txt exists
    if (!fs.existsSync(verPath)) {
        fs.writeFileSync(verPath, "OLD");
        console.log("Created Alk version file.");
    }

    await fs.readFile(verPath, 'utf8', async function (err: any, data: any) {
        if (err) {
            return console.log(err);
        }
        var response = await axios.get("https://api.github.com/repos/alk-language/java-semantics/releases/latest");
        if (response['data']['tag_name'] !== data) {
            if (data === 'not installed') {
                vscode.window.showInformationMessage(`Setting up Alk for the first time`);
            }
            else {
                vscode.window.showInformationMessage(`Updating Alk from ${data} to latest version (${response['data']['tag_name']})`);
            }
            console.log('Updating Alk.');
            await downloadAlk(response['data']['tag_name'], alkPath);
        }
        else {
            vscode.window.showInformationMessage(`Alk is up to date (${response['data']['tag_name']})`);
        }
    });
}

async function downloadAlk(version: string, alkPath: any) {
    const fs = require('fs').promises;
    const fsf = require('fs');
    const download = require('download');
    const extract = require('extract-zip');
    const fse = require('fs-extra');
    const del = require('del');
    const path = require('path');
    const os = require('os');
    const tmpPath = os.type() === 'Windows_NT' ? '.' : '/tmp';
    const tmpArchive = path.join(tmpPath, 'alk.zip');
    const tmpFolder = path.join(tmpPath, 'alk-temp-folder');
    const absTmpFolder = path.resolve(tmpFolder);
    const tagName = version;
    version = version.replace('v', '');

    // Delete old tmp folder if exists
    await del(absTmpFolder, { force: true });

    try {
        // Download new alk
        fsf.writeFileSync(tmpArchive, await download(`https://github.com/alk-language/java-semantics/releases/download/${tagName}/alki-v${version}.zip`));

        // Unzip new alk using extract-zip
        await extract(tmpArchive, { dir: absTmpFolder });  // Ensure the path is absolute

        // Delete old alk folder
        await client.stop();
        await del(alkPath, { force: true });
        console.log(`Old Alk folder deleted.`);

        // Recreate alk folder
        await fse.ensureDir(alkPath);  // Use ensureDir to create the directory if it doesn't exist
        console.log("Successfully created Alk folder.");

        // Create new version file
        fsf.writeFileSync(path.join(alkPath, 'version.txt'), tagName);
        console.log('Created new version file.');

        // Move files
        await fse.move(path.join(tmpFolder, `v${version}`, 'bin', 'alk.jar'), path.join(alkPath, 'alk.jar'));
        await fse.move(path.join(tmpFolder, `v${version}`, 'bin', 'alki.sh'), path.join(alkPath, 'alki.sh'));
        await fse.move(path.join(tmpFolder, `v${version}`, 'bin', 'alki.bat'), path.join(alkPath, 'alki.bat'));
        await fse.move(path.join(tmpFolder, `v${version}`, 'bin', 'alkls.sh'), path.join(alkPath, 'alkls.sh'));
        await fse.move(path.join(tmpFolder, `v${version}`, 'bin', 'alkls.bat'), path.join(alkPath, 'alkls.bat'));
        await fse.move(path.join(tmpFolder, `v${version}`, 'bin', 'lib'), path.join(alkPath, 'lib'));
        console.log("Successfully moved files.");

        // Delete downloaded folder
        await del(tmpFolder);
        console.log(`Folder deleted.`);

        // Delete downloaded archive
        await fs.unlink(tmpArchive);
        console.log('Archive deleted.');

        console.log('Updated Alk.');
        vscode.window.showInformationMessage(`Updated Alk to the latest version (${version})`);

        await client.start();
    } catch (err) {
        console.error(`Error updating Alk. ${err}.`);
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}