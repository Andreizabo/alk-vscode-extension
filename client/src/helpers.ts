import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

function getInputString()
{
    let input = "";
    const inputDict: Object | undefined = vscode.workspace.getConfiguration('alk.initialStateMode').get('asText');
    if (!inputDict)
    {
        console.log("Input object is undefinded");
        return "";
    }
    for (const [key, value] of Object.entries(inputDict)) 
    {
        input += `${key} |-> ${value}\n`;
    }
    return input;
}

export function getOptionsString(exhaustive: boolean)
{
    let options = '';
    if (vscode.workspace.getConfiguration('alk').get('metadata'))
    {
        options += '-m ';
    }
    if (vscode.workspace.getConfiguration('alk').get('precision'))
    {
        options += `-p ${vscode.workspace.getConfiguration('alk').get('precision')} `;
    }
    if (vscode.workspace.getConfiguration('alk').get('symbolicExecution'))
    {
        options += '-s -smt="Z3" ';
    }
    if (exhaustive)
    {
        options += '-e ';
    }
    if (vscode.workspace.getConfiguration('alk').get('initialState '))
    {
        options += '-i ';
        if (vscode.workspace.getConfiguration('alk').get('initialStateMode ') === 'Text')
        {
            options += '"';
            options += getInputString().split('\n').join(" ").split('"').join('\\"');
            options += '"';
        }
        else
        {
            const editor = vscode.window.activeTextEditor;
            if (editor)
            {
                const filePath = editor.document.uri.fsPath;
                const fileName : string | undefined = vscode.workspace.getConfiguration('alk.initialStateMode').get('filePath');
                if (fileName)
                {
                    if (path.isAbsolute(fileName)){
                        options += `"${fileName}" `;
                    }
                    else {
                        const inputFilePath = path.join(path.dirname(filePath), fileName);
                        options += `"${inputFilePath}" `;
                    }
                }
                else
                {
                    console.log("Input file name is undefined");
                }
            }
            else
            {
                vscode.window.showErrorMessage('No active editor');
            }
        }
    }
    return options;
}

export function displayJavaHelp(alkOutput: vscode.OutputChannel) {
    alkOutput.appendLine('Java is not installed. Please install Java and restart VS Code.');
    if (os.type() === 'Windows_NT') {
        alkOutput.appendLine('You can download Java from https://www.java.com/en/download/');
        alkOutput.appendLine('After installing Java, you have to add it to the Path environment variable.');
        alkOutput.appendLine('You can do it by searching for "Environment Variables" in the Start menu, then click Environment Variables in the window that opened.');
        alkOutput.appendLine('In the System variables tab, search for the Path variable, click it, and then click on Edit.');
        alkOutput.appendLine('Click on New, then add the path where you installed Java (the default one is C:\\Program Files\\Java\\<version>\\bin), then click OK.');
    }
    else if (os.type() === "Linux") {
        alkOutput.appendLine('You can install Java from the command line by running the following command:');
        alkOutput.appendLine('sudo apt-get install default-jre');
    }
    else {
        alkOutput.appendLine('You can download Java from https://www.java.com/en/download/');
    }
    alkOutput.show(true);
}

export const javaInstalled = checkJavaInstalled();

function checkJavaInstalled() 
{
    const cp = require('child_process');
    let ok1 = true, ok2 = true;
    try {
        cp.execSync('java --version');
    }
    catch (e) {
        ok1 = false;
    }
    try {
        cp.execSync('java -version');
    }
    catch (e) {
        ok2 = false;
    }
    return ok1 || ok2;
}

export async function getUserQuickPick(list: string[], title?: string, onDidSelectItem?: (item: string) => void)
{
    let options: vscode.QuickPickOptions = title ? { canPickMany:false, title: title } : { canPickMany:false };
    options.onDidSelectItem = onDidSelectItem;
    return await vscode.window.showQuickPick(list, options);
}

export function showInfoMessage(message: string)
{
    vscode.window.showInformationMessage(message);
}

const currentCheckpointDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 255, 0, 0.3)'
});

const otherCheckpointDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 255, 0, 0.1)'
});

export function highlightLine(lines: number[], focusLine: number)
{
    const editor = vscode.window.activeTextEditor;
    if (editor)
    {
        const doc = editor.document;
        let focusLines = [];
        let otherLines = [];
        for (const line of lines)
        {
            if (line === focusLine)
            {
                focusLines.push(doc.lineAt(line).range);
            }
            else
            {
                otherLines.push(doc.lineAt(line).range);
            }
        }
        editor.setDecorations(currentCheckpointDecoration, focusLines);
        editor.setDecorations(otherCheckpointDecoration, otherLines);
    }
}

export function clearHighlights()
{
    const editor = vscode.window.activeTextEditor;
    if (editor)
    {
        editor.setDecorations(currentCheckpointDecoration, []);
        editor.setDecorations(otherCheckpointDecoration, []);
    }
}