import * as vscode from 'vscode';
import { AlkViewProvider } from './alkViewProvider';

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

export function activate(context: vscode.ExtensionContext) 
{
	console.log('Extension active');
	const alkProvider = new AlkViewProvider(context.extensionUri);
	const alkOutput = vscode.window.createOutputChannel("Alk Output");

	let disposable = vscode.commands.registerCommand('alk.run', () => {
		const editor = vscode.window.activeTextEditor;
		//var terminal = vscode.window.activeTerminal;
		if (!editor) 
		{
			vscode.window.showErrorMessage('No active editor');
			return;
		}
		const alkPath = vscode.workspace.getConfiguration('alk').get('path');
		if (!alkPath)
		{
			vscode.window.showErrorMessage('No alk path configured');
			return;
		}
		// if (!terminal)
		// {
		// 	terminal = vscode.window.createTerminal('Alk');
		// }
		const options = alkProvider.getOptionsString();
		
		const path = editor.document.uri.fsPath;
		//terminal.show();
		//terminal.sendText(`${alkPath} -a ${path} ${options}`);
		const cp = require('child_process');
		cp.exec(`${alkPath} -a ${path} ${options}`, (err: any, stdout: any, stderr: any) => {
			alkOutput.appendLine(stdout);
			alkOutput.appendLine(stderr);
			if (stdout || stderr) { 
				handleErrors(stdout, stderr);
			}
			alkOutput.show(true);
			if (err) {
				console.log(`err: ${err}`);
			}

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
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AlkViewProvider.viewType, alkProvider)
	);
}

export function deactivate() {}
