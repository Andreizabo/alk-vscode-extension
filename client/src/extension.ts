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

function runAlkFile(context: vscode.ExtensionContext, alkOutput: vscode.OutputChannel, javaInstalled: boolean, exhaustive = false) {
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

            const options = getOptionsString(exhaustive);

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
        runAlkFile(context, alkOutput, javaInstalled, false);
    });

    let exhaustiveDisposable = vscode.commands.registerCommand('alk.runExhaustive', () => {
        runAlkFile(context, alkOutput, javaInstalled, true);
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
    await fs.readFile(path.join(alkPath, 'version.txt'), 'utf8', async function (err: any, data: any) {
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
            console.log('Updating alk');
            await downloadAlk(response['data']['tag_name'], alkPath);
        }
        else {
            vscode.window.showInformationMessage(`Alk is up to date (${response['data']['tag_name']})`);
        }
    });
}

async function downloadAlk(version: string, alkPath: any) {
    const fs = require('fs');
    const download = require('download');
    const unzipper = require('unzipper');
    const mv = require('mv');
    const del = require('del');
    const tmpPath = os.type() === 'Windows_NT' ? '.' : '/tmp';
    const tmpArchive = path.join(tmpPath, 'alk.zip');
    const tmpFolder = path.join(tmpPath, 'alk-temp-folder');
    const tagName = version;
    version = version.replace('v', '');
    // Download new alk
    await fs.writeFileSync(tmpArchive, await download(`https://github.com/alk-language/java-semantics/releases/download/${tagName}/alki-v${version}.zip`));
    // Unzip new alk
    await fs.createReadStream(tmpArchive).pipe(unzipper.Extract({ path: tmpFolder })).on('close', async function () {
        // Delete old alk folder
        try {
            await del(alkPath, { force: true });
            console.log(`Old alk folder deleted!`);
            await fs.mkdir(alkPath, async function (err: any) {
                if (err) {
                    console.log(`Error recreating alk folder. ${err}`);
                } else {
                    console.log("Successfully created alk folder!");
                    // Create new version file
                    await fs.writeFile(path.join(alkPath, 'version.txt'), tagName, function (err: any) {
                        if (err) {
                            console.log(`Error creating new version file. ${err}`);
                        }
                        console.log('Created new version file!');
                    });
                    // Move files
                    await mv(path.join(tmpFolder, `v${version}`, 'bin', 'alk.jar'), path.join(alkPath, 'alk.jar'), async function (err: any) {
                        if (err) {
                            console.log(`Error moving files. ${err}`);
                        } else {
                            console.log("Successfully moved the jar!");
                        }
                        await mv(path.join(tmpFolder, `v${version}`, 'bin', 'alki.sh'), path.join(alkPath, 'alki.sh'), async function (err: any) {
                            if (err) {
                                console.log(`Error moving files. ${err}`);
                            } else {
                                console.log("Successfully moved the sh!");
                            }
                            await mv(path.join(tmpFolder, `v${version}`, 'bin', 'alki.bat'), path.join(alkPath, 'alki.bat'), async function (err: any) {
                                if (err) {
                                    console.log(`Error moving files. ${err}`);
                                } else {
                                    console.log("Successfully moved the bat!");
                                }
                                await mv(path.join(tmpFolder, `v${version}`, 'bin', 'lib'), path.join(alkPath, 'lib'), async function (err: any) {
                                    if (err) {
                                        console.log(`Error moving files. ${err}`);
                                    } else {
                                        console.log("Successfully moved lib!");
                                    }
                                    //Delete downloaded folder
                                    try {
                                        await del(tmpFolder);
                                        console.log(`Folder deleted!`);
                                    } catch (err) {
                                        console.error(`Error while deleting folder. ${err}`);
                                    }
                                    // Delete downloaded archive
                                    await fs.unlink(tmpArchive, (err: any) => {
                                        if (err) {
                                            console.error(`Error while deleting archive. ${err}`);
                                            return;
                                        }
                                        console.log('Archive deleted.');
                                    });
                                    console.log('Updated alk');
                                    vscode.window.showInformationMessage(`Updated Alk to latest version (${version})`);
                                });
                            }
                            );
                        }
                        );
                    }
                    );
                }
            });
        } catch (err) {
            console.error(`Error while deleting old alk folder. ${err}`);
        }
    });
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

vscode.languages.registerDocumentFormattingEditProvider('alk', {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        function removeAllSpaces(line: string) {
            return line.trim().replace(/\s\s+/g, ' ');
        }
        function makeTabs(tabs: number) {
            let tab = '';
            for (let i = 0; i < tabs; ++i) {
                tab += '\t';
            }
            return tab;
        }
        function getPosition(string: string, subString: string, index: number) {
            if (!string.includes(subString)) {
                return -1;
            }
            return string.split(subString, index).join(subString).length;
        }
        function countChar(string: string, chr: string) {
            return string.split(chr).length - 1;
        }
        function insertAt(string: string, inst: string, index: number) {
            return string.substring(0, index) + inst + string.substring(index);
        }
        function replaceAt(string: string, replace: string, index: number) {
            return string.substring(0, index) + replace + string.substring(index + replace.length);
        }
        function deleteAt(string: string, index: number) {
            return string.substring(0, index) + string.substring(index + 1);
        }
        function conditional(string: string) {
            let stripped = removeAllSpaces(string);
            return stripped.startsWith("if") ||
                stripped.startsWith("while") ||
                stripped.startsWith("else") ||
                stripped.startsWith("for") ||
                stripped.startsWith("repeat") ||
                stripped.startsWith("foreach") ||
                stripped.startsWith("forall") ||
                stripped.startsWith("do");
        }
        function conditionalWithPhar(string: string) {
            let stripped = removeAllSpaces(string);
            return stripped.startsWith("if") ||
                stripped.startsWith("while") ||
                stripped.startsWith("for") ||
                stripped.startsWith("foreach") ||
                stripped.startsWith("forall");
        }
        function handleBlock(line: string, tabs: number, handledConditional: number, preservedConditional: number, expPhar: number, expFuncPhar: number) {
            let len = line.length;
            line = removeAllSpaces(line).replace('/\n/g', '').replace('/\t/g', '').replace('/\s/g', '');
            let i = 0;
            if (line[i] === '{') {
                i = 1;
            }
            let lastWasntInstr = true;
            while (i < len) {
                if (expPhar === 0 && expFuncPhar === 0) {
                    if (line[i] === '{') {
                        lastWasntInstr = true;
                        if (handledConditional > 0) {
                            preservedConditional = handledConditional - 1;
                            handledConditional = 0;
                            --tabs;
                        }
                        line = insertAt(line, '\n' + makeTabs(tabs), i);
                        ++tabs;
                        i += tabs;
                        len += tabs;
                    }
                    else if (line[i] === '}') {
                        lastWasntInstr = true;
                        --tabs;
                        line = insertAt(line, '\n' + makeTabs(tabs), i);
                        i += tabs + 1;
                        len += tabs + 1;
                        handledConditional = preservedConditional;
                    }
                    else if (line[i] === ' ' || line[i] === '\t') {
                        lastWasntInstr = true;
                        line = replaceAt(line, '', i);
                    }
                    else if (lastWasntInstr) {
                        lastWasntInstr = false;
                        line = insertAt(line, '\n' + makeTabs(tabs), i);
                        i += tabs + 1;
                        len += tabs + 1;

                        if (conditional(line.substring(i))) {
                            ++tabs;
                            if (conditionalWithPhar(line.substring(i))) {
                                i += line.substring(i).indexOf('(');
                                ++expPhar;
                            }
                            else {
                                ++handledConditional;
                            }
                        }
                        else {
                            if (handledConditional > 0) {
                                --tabs;
                                --handledConditional;
                            }
                            if (removeAllSpaces(line.substring(i, line.substring(i).indexOf('('))).length === 0) {
                                i += line.substring(i).indexOf('(');
                                ++expFuncPhar;
                            }
                            else {
                                i += line.substring(i).indexOf(';');
                            }
                        }
                    }
                }
                else if (expPhar === 0 && expFuncPhar > 0) {
                    if (line[i] === '(') {
                        ++expFuncPhar;
                        line = insertAt(line, '\n' + makeTabs(tabs), i);
                        ++tabs;
                        i += tabs;
                        len += tabs;
                    }
                    else if (line[i] === ')') {
                        --expFuncPhar;
                        if (i === 0) {
                            line = insertAt(line, makeTabs(tabs), i);
                            i += tabs;
                            len += tabs;
                        }
                    }
                }
                else if (expPhar > 0 && expFuncPhar === 0) {
                    if (line[i] === '(') {
                        ++expPhar;
                    }
                    else if (line[i] === ')') {
                        --expPhar;
                        if (expPhar === 0) {
                            ++handledConditional;
                        }
                    }
                }
                ++i;
            }
            return {
                "line": line,
                "tabs": tabs,
                "handledConditional": handledConditional,
                "preservedConditional": preservedConditional,
                "expPhar": expPhar,
                "expFuncPhar": expFuncPhar
            };
        }
        function spacing(line: string) {
            let doubleSpace = ['+', '-', '*', ':', '/', '=', '<', '>', "+=", "-=", '*=', "/=", "==", "<=", ">="];
            let singleSpace = [';', ',', '.', "++", "--"];
            for (var symbol of doubleSpace) {
                let index = getPosition(line, symbol, 1);
                let i = 1;
                while (index !== -1 && index < line.length) {
                    if ((index > 0 && doubleSpace.includes(line.substring(index - 1, index + symbol.length))) || doubleSpace.includes(line.substring(index, index + 1 + symbol.length)) ||
                    (index > 0 && singleSpace.includes(line.substring(index - 1, index + symbol.length))) || singleSpace.includes(line.substring(index, index + 1 + symbol.length))) {
                        index = getPosition(line, symbol, ++i);
                        continue;
                    }
                    if (index > 0) {
                        if (line[index - 1] !== ' ') {
                            line = insertAt(line, ' ', index);
                            ++index;
                        }
                    }
                    if (line[index + symbol.length] !== ' ') {
                        line = insertAt(line, ' ', index + symbol.length);
                    }
                    index = getPosition(line, symbol, ++i);
                }
            }
            for (var symbol of singleSpace) {
                let index = getPosition(line, symbol, 1);
                let i = 1;
                while (index !== -1 && index < line.length) {
                    if ((index > 0 && doubleSpace.includes(line.substring(index - 1, index + 1))) || doubleSpace.includes(line.substring(index, index + 2)) ||
                    (index > 0 && singleSpace.includes(line.substring(index - 1, index + 1))) || singleSpace.includes(line.substring(index, index + 2))) {
                        index = getPosition(line, symbol, ++i);
                        continue;
                    }
                    if (index > 0) {
                        if (line[index - 1] === ' ') {
                            line = deleteAt(line, index - 1);
                        }
                    }
                    if (line[index + symbol.length] !== ' ' && line[index + symbol.length] !== '\n' && line[index + symbol.length] !== '\t') {
                        line = insertAt(line, ' ', index + symbol.length);
                    }
                    index = getPosition(line, symbol, ++i);
                }
            }
            return line;
        }

        const linesNo = document.lineCount;
        let operations: vscode.TextEdit[] = [];
        let tabs = 0;
        let handledConditional = 0;
        let preservedConditional = 0;
        let expPhar = 0;
        let expFuncPhar = 0;
        let lineArr: string[] = [];
        for (let i = 0; i < linesNo; ++i) {
            lineArr.push(document.lineAt(i).text);
        //     let thisLine = document.lineAt(i).text;

        //     let result = handleBlock(thisLine, tabs, handledConditional, preservedConditional, expPhar, expFuncPhar);
        //     thisLine = result["line"];
        //     handledConditional = result["handledConditional"];
        //     preservedConditional = result["preservedConditional"];
        //     expPhar = result["expPhar"];
        //     expFuncPhar = result["expFuncPhar"];

        //     operations.push(vscode.TextEdit.replace(document.lineAt(i).range, thisLine.replace('\n', '')));

        //     tabs = result["tabs"];
            operations.push(vscode.TextEdit.delete(document.lineAt(i).range));
        }

        //writeFileSync(document.uri.fsPath, '', {flag: 'w'});

        let superLine = lineArr.join(" ");
        superLine = handleBlock(superLine, 0, 0, 0, 0, 0)["line"];
        superLine = spacing(superLine);
        operations.push(vscode.TextEdit.insert(document.lineAt(0).range.start, superLine));
        return operations;
    }
});