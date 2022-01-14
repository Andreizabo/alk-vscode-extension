import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { AlkViewProvider } from './alkViewProvider';
import { cpuUsage } from 'process';
import { ChildProcess } from 'child_process';
import axios from 'axios';
import { writeFile } from 'fs';

let errorExists = false;

//  let errorDecoration = vscode.window.createTextEditorDecorationType({
// 	backgroundColor: "#A1000066",
// 	// border: '2px solid white',
// 	after: {
// 		contentText: "\tIon buleala!",
// 		textDecoration: "underline"
// 	}
// });

type ErrorDecoration = {
	decoration: vscode.TextEditorDecorationType;
	errorMessages: String[];
};

let errorDecorations: {[id: number]: ErrorDecoration } = {};

function getLineLen(doc: String, index: number): number {
	let lines = doc.split('\n');
	return lines[index].length;
}

function createErrorDecoration(errorMessage: String)
{
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
	if(vscode.window.activeTextEditor) {
		for (let line of [stderr, stdout].join('\n').split('\n')) 
		{
			if (line.match(/Error at \[[0-9]+:[0-9]+\]:/g)) {
				const errorMessage = line.split('Error at [')[1].split(']: ')[1];
				const resCoords = line.split('[')[1].split(']')[0].split(':');
				const lineNum = parseInt(resCoords[0]);
				if (errorDecorations[lineNum]) 
				{
					errorDecorations[lineNum].errorMessages.push(errorMessage);
					errorDecorations[lineNum].decoration.dispose();
					errorDecorations[lineNum].decoration = createErrorDecoration(errorDecorations[lineNum].errorMessages.join(', '));
				}
				else
				{
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
				if (errorDecorations[lineNum])
				{
					errorDecorations[lineNum].errorMessages.push(errorMessage);
					errorDecorations[lineNum].decoration.dispose();
					errorDecorations[lineNum].decoration = createErrorDecoration(errorDecorations[lineNum].errorMessages.join(', '));
				}
				else 
				{
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
		for (let key in errorDecorations) 
		{
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

function displayJavaHelp(alkOutput: vscode.OutputChannel)
{
	alkOutput.appendLine('Java is not installed. Please install Java and restart VS Code.');
	if (os.type() === 'Windows_NT')
	{
		alkOutput.appendLine('You can download Java from https://www.java.com/en/download/');
		alkOutput.appendLine('After installing Java, you have to add it to the Path environment variable.');
		alkOutput.appendLine('You can do it by searching for "Environment Variables" in the Start menu, then click Environment Variables in the window that opened.');
		alkOutput.appendLine('In the System variables tab, search for the Path variable, click it, and then click on Edit.');
		alkOutput.appendLine('Click on New, then add the path where you installed Java (the default one is C:\\Program Files\\Java\\<version>\\bin), then click OK.');
	}
	else if (os.type() === "Linux")
	{
		alkOutput.appendLine('You can install Java from the command line by running the following command:');
		alkOutput.appendLine('sudo apt-get install default-jre');
	}
	else
	{
		alkOutput.appendLine('You can download Java from https://www.java.com/en/download/');
	}
	alkOutput.show(true);
}

function checkJavaInstalled(alkOutput: vscode.OutputChannel)
{
	const cp = require('child_process');
	let ok1 = true, ok2 = true;
	try
	{
		cp.execSync('java --version');
	}
	catch(e)
	{
		ok1 = false;
	}
	try
	{
		cp.execSync('java -version');
	}
	catch(e)
	{
		ok2 = false;
	}
	return ok1 || ok2;
}

function replacePath(path: string) {
    let separator = os.type() === 'Windows_NT' ? '\r\n' : '\n';
    let parts = path.split(separator).filter(p => p !== '');
    parts.shift();
    return parts.join(separator);
}

let currentRunningProcess: ChildProcess | null = null;

function runAlkFile(context: vscode.ExtensionContext, alkProvider: AlkViewProvider, alkOutput: vscode.OutputChannel,javaInstalled: boolean, exhaustive = false)
{
	console.log('runAlkFile');
	if (!javaInstalled)
	{
		displayJavaHelp(alkOutput);
		return;
	}

	if(errorExists) {
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
	if (!editor) 
	{
		vscode.window.showErrorMessage('No active editor');
		return;
	}
	
	const alkRunScript = os.type() === 'Windows_NT' ? 'alki.bat' : 'alki.sh';
	const alkPath = path.join(context.extensionUri.fsPath, 'media', 'alk', 'v3.0', 'bin', alkRunScript);
	if (!alkPath)
	{
		vscode.window.showErrorMessage('No alk path configured');
		return;
	}
	// if (!terminal)
	// {
	// 	terminal = vscode.window.createTerminal('Alk');
	// }
	const options = alkProvider.getOptionsString(exhaustive);
	
	const filePath = editor.document.uri.fsPath;
	//terminal.show();
	//terminal.sendText(`${alkPath} -a ${path} ${options}`);
	const cp = require('child_process');
	const command = (os.type() === 'Windows_NT' ? '' : '/bin/bash ') + `"${alkPath}" -a "${filePath}" ${options}`;
	if (vscode.workspace.getConfiguration('alk').get('showCommand'))
	{
		alkOutput.appendLine(command);
	}
	else
	{
		alkOutput.appendLine(`Running ${filePath}`);
	}
	alkOutput.show(true);
	
	vscode.commands.executeCommand('setContext', 'alk.canRun', false);
	currentRunningProcess = cp.exec(command, {detached: true}, (err: any, stdout: any, stderr: any) => {
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
			if (_change.document === editor.document) 
			{
				if(errorExists) {
					// vscode.window.activeTextEditor?.setDecorations(errorDecoration, []);
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

export function activate(context: vscode.ExtensionContext) 
{
	console.log('Extension active');
	vscode.commands.executeCommand('setContext', 'alk.canRun', true);
	const alkProvider = new AlkViewProvider(context.extensionUri);
	const alkOutput = vscode.window.createOutputChannel("Alk Output");
	const javaInstalled = checkJavaInstalled(alkOutput);

	let disposable = vscode.commands.registerCommand('alk.run', () => {
		runAlkFile(context, alkProvider, alkOutput, javaInstalled, false);
	});

	let exhaustiveDisposable = vscode.commands.registerCommand('alk.runExhaustive', () => {
		runAlkFile(context, alkProvider, alkOutput, javaInstalled, true);
	});

	let stopDisposable = vscode.commands.registerCommand('alk.stop', () => {
		if (currentRunningProcess)
		{
			const kill = require('tree-kill');
			alkOutput.appendLine('Stopping Alk');
			kill(currentRunningProcess.pid, (err: any) => {
				if (err)
				{
					alkOutput.appendLine(`Error while stopping alk. ${err}`);
				}
				else
				{
					alkOutput.appendLine('Alk stopped');
				}
			});
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(exhaustiveDisposable);
	context.subscriptions.push(stopDisposable);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AlkViewProvider.viewType, alkProvider)
	);
}

export async function vers() {
    // const url: string = 'your-url.example';

    // try {
    //     // Checks version
    //     var response = await axios.get("https://api.github.com/repos/alk-language/java-semantics/releases/latest");
    //     console.log(response['data']['tag_name']);
    //     // Downloads new version
    //     const fs = require('fs');
    //     const download = require('download');
    //     const unzipper = require('unzipper');
    //     fs.writeFileSync('./alk.zip', await download('https://github.com/alk-language/java-semantics/releases/download/3.0/alki-v3.0.zip'));
    //     fs.createReadStream('./alk.zip').pipe(unzipper.Extract({ path: './alk-temp-folder' }));
    //     console.log(`./alk-temp-folder/v${response['data']['tag_name']}/bin/alk.jar`);
    //     fs.rename(`./alk-temp-folder/v${response['data']['tag_name']}/bin/alk.jar`, 'E:\\alk.jar');   
    // } catch (exception) {
    //     process.stderr.write(`ERROR received from ${url}: ${exception}\n`);
    // }
}

export function deactivate() {}
