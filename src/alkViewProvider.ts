import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class AlkViewProvider implements vscode.WebviewViewProvider
{
    public static readonly viewType = 'alk.optionsView';

    private _view?: vscode.WebviewView;

    private _options: { [id: string]: boolean|number|string } = {};
    private _input: { [id: string]: string } = {};
    private _inputFile: string = "";

    constructor (private readonly _extensionUri: vscode.Uri) { }

    public getInputString()
    {
        let input = "";
        for (const inputKey in this._input)
        {
            input += `${inputKey} |-> ${this._input[inputKey]}\n`;
        }
        return input;
    }

    public getOptionsString(exhaustive: boolean)
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
        if (exhaustive)
        {
            options += '-e ';
        }
        for (const key in this._options)
        {
            if (this._options[key])
            {
                options += `-${key} `;
                if (key === 'p')
                {
                    options += `${this._options[key]} `;
                }
                else if (key === 'i')
                {
                    console.log(this._input);
                    if (this._options[key] === 'input-list')
                    {
                        options += '"';
                        options += this.getInputString().split('\n').join(" ").split('"').join('\\"');
                        // for (const inputKey in this._input)
                        // {
                        //     options += `${inputKey} |-> ${this._input[inputKey]} `.split('"').join('\\"');
                        // }
                        options += '"';
                    }
                    else
                    {
                        const projectRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
                        options += `${path.join(projectRoot, this._inputFile)}`;
                    }
                }
                options += ' ';
            }
        }
        return options;
    }

    public async saveInput()
    {
        const saveFile = await vscode.window.showInputBox({
            prompt: 'Input file',
        });
        const projectRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
        if (saveFile && projectRoot)
        {
            const inputFile = path.join(projectRoot, saveFile);
            const inputFileContent = this.getInputString();
            fs.writeFileSync(inputFile, inputFileContent);
        }
    }

    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken)
    {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
        };

        webviewView.webview.html = this.getWebviewContent();

        webviewView.webview.onDidReceiveMessage(message => {
            console.log(message);
            switch (message.command) {
                case 'metadata':
                    // this._options["m"] = message.value;
                    break;
                case 'exhaustive':
                    // this._options["e"] = message.value;
                    break;
                case "precision":
                    // if (message.value !== -1)
                    // {
                    //     this._options["p"] = message.value;
                    // }
                    // else
                    // {
                    //     delete this._options["p"];
                    // }
                    break;
                case "input":
                    if (message.value !== "")
                    {
                        this._options["i"] = message.value;
                    }
                    else
                    {
                        delete this._options["i"];
                    }
                    break;
                case "input-value":
                    if (this._options["i"] === "input-list")
                    {
                        if (message.value.value !== "")
                        {
                            this._input[message.value.key] = message.value.value.split('\n').join(' ');
                        }
                        else
                        {
                            delete this._input[message.value.key];
                            console.log(`Deleted key ${message.value.key}`);
                        }
                    }
                    else
                    {
                        this._inputFile = message.value;
                    }
                    break;
                case "save":
                    this.saveInput();
                    break;
                default:
                    console.error(`Unknown command: ${message.command}`);
            }
        });
    }

    private getWebviewContent()
    {
        try
        {
            const cssPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css');
            const jsPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js');
            const cssUri = cssPath.with({ scheme: 'vscode-resource' });
            const jsUri = jsPath.with({ scheme: 'vscode-resource' });
            let content = fs.readFileSync(path.join(this._extensionUri.fsPath, 'media', 'webview.html'), 'utf8');
            content = content.replace('{{cssPath}}', cssUri.toString()).replace('{{jsPath}}', jsUri.toString());
            return content;
        }
        catch (e)
        {
            console.error(e);
        }
        return '';
    }
}