/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
    AlkServerComm
} from './alkServerComm'
import { exit } from 'process';
import path = require('path');
import { SignatureHelp } from 'vscode';

const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
const alphanum = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890";

const serverComm = new AlkServerComm();

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// function communicateWithServer(context: String, command: String): Promise<String> {
// 	let client = new Socket();
// 	client.connect(7979, '127.0.0.1', function() {
// 		client.write(context + ' ' + command);
// 	});
// 	return new Promise((resolve: any, reject: any) => {
// 		let count = 0;
// 		let expected = -1;
// 		let result = "";
// 		client.on('data', function(data) {
// 			let got = data.toString().split('\n');
// 			got.pop();
// 			let start = 0;
// 			if(expected == -1) {
// 				expected = parseInt(got[0]);
// 				result += (got[0] + '\n');
// 				start = 1;
// 			}
// 			for(let i = start; i < got.length; ++i) {
// 				result += (got[i] + '\n');
// 				++count;
// 			}
// 			if(count == expected) {
// 				client.end();
// 				resolve(result);
// 			}
// 		});
// 	});
// }

// function getCoords(text: String, line: number, index: number): number[] {
// 	try {
// 		let starting: number = 0;
// 		let lines = text.split('\r\n');
// 		for(let i = 0; i < line - 1; ++i) {
// 			starting += (lines[i].length + 2);
// 		}
// 		starting += index;
// 		return [starting, starting];
// 	}
// 	catch {
// 		return [0, 0];
// 	}
// }

// function makeText(text: String): String {
// 	return text.split('\n').join('`').split('\r').join('~');
// }

connection.onInitialize((params: InitializeParams) => {
    console.log("test");
    serverComm.start(__dirname + "\\..\\..\\media\\alk\\alkls.bat");
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
            signatureHelpProvider: {
                triggerCharacters: [ '(', ')', ',' ]
            },
            definitionProvider: true,
            hoverProvider: true,
            referencesProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
    console.log("test2");
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	//documents.all().forEach(validateTextDocument);
    console.log("Config hello :)");
});

// function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
// 	if (!hasConfigurationCapability) {
// 		return Promise.resolve(globalSettings);
// 	}
// 	let result = documentSettings.get(resource);
// 	if (!result) {
// 		result = connection.workspace.getConfiguration({
// 			scopeUri: resource,
// 			section: 'languageServerExample'
// 		});
// 		documentSettings.set(resource, result);
// 	}
// 	return result;
// }

// Only keep settings for open documents
documents.onDidClose(e => {
    console.log("bye");
	documentSettings.delete(e.document.uri);
});


let cachedDoc : string = '';
let cachedDocPath : string = '';

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async change => {
    let url = require('url');

    cachedDoc = change.document.getText();

    if (cachedDoc.trim().length > 0) {
        cachedDocPath = url.fileURLToPath(change.document.uri);

        let args = cachedDoc.split('\n').map(x => x + '\n');
        args.unshift(cachedDoc.split('\n').length + '\n');
        var result = await serverComm.writeCommand('load ' + url.fileURLToPath(change.document.uri) + '\n', args);
    }
	//validateTextDocument(change.document);
    console.log('Hello');
});

// async function validateTextDocument(textDocument: TextDocument): Promise<void> {
// 	// In this simple example we get the settings for every validate run.
// 	const settings = await getDocumentSettings(textDocument.uri);

// 	let problems = 0;
// 	const diagnostics: Diagnostic[] = [];	
// 	let result: String = await communicateWithServer('compile', makeText(textDocument.getText()) + "\n");
// 	console.log("COMPILE-START");
// 	console.log(result);
// 	console.log("COMPILE-END");
	
// 	let warns = result.split('\n');
// 	warns.shift();
// 	warns.pop();	

// 	for(let i = 0; i < warns.length && problems < settings.maxNumberOfProblems; ++i) {
// 		++problems;
// 		let res_coords = warns[i].split(' ')[1].split(':')
// 		let coords = getCoords(textDocument.getText(), parseInt(res_coords[0]), parseInt(res_coords[1]));
// 		const diagnostic: Diagnostic = {
// 			severity: DiagnosticSeverity.Error,
// 			range: {
// 				start: textDocument.positionAt(coords[0]),
// 				end: textDocument.positionAt(coords[1])
// 			},
// 			message: warns[i],
// 			source: 'ex'
// 		};
// 		diagnostics.push(diagnostic);
// 	}
// 	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
// }

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(async (completionParams): Promise<CompletionItem[]> => {
		const result = await serverComm.writeCommand('all-symbols ' + (completionParams.position.line + 1) + "\n");

        result.shift();

		const autoc = [];

		for(let i = 0; i < result.length; ++i) {
            const varname = result[i].replace('\n', '').replace('\r', '');
            const res = await serverComm.writeCommand('function ' + varname + '\n');

            if (!res[0].startsWith('No function')) {
                autoc.push({
                    label: varname,
                    kind: CompletionItemKind.Function,
                    data: i + 2
                });
            }
			else {
                autoc.push({
                    label: varname,
                    kind: CompletionItemKind.Variable,
                    data: i + 2
                });
            }
		}

		return autoc;
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(async (item: CompletionItem): Promise<CompletionItem> => {
		const varname = item.label;

        const result = await serverComm.writeCommand('function ' + varname + '\n');
        const func_sign = result[0].replace('\r', '').replace('\n', '');

        if (!result[0].startsWith('No function')) {
            item.detail = func_sign;
        }

		return item;
	}
);




// -----------
// NEW STUFF
// -----------

// FUNCTION SIGNATURE HELP

let last_function: any[] = [];

connection.onSignatureHelp(async (signatureHelpParms): Promise<any>  => {
    if (signatureHelpParms.context?.triggerCharacter === '(')
    {
        let pars = []
        let func_sign = '';
        // if (signatureHelpParms.context?.isRetrigger == true) {
        //     const lf = last_function[last_function.length-1];
        //     func_sign = lf['name'];
        //     pars = lf['pars'];
        // }
        //else {
            const func_name = readWordBefore(readDocLine(signatureHelpParms.position.line), signatureHelpParms.position.character - 1);
            const result = await serverComm.writeCommand('function ' + func_name + '\n');
            func_sign = result[0].replace('\r', '').replace('\n', '')

            pars = [];
            const unparsed = func_sign.split('(')[1].replace(')', '').replace(' ', '').replace('\t', '').split(',');
            for (let i = 0; i < unparsed.length; ++i) {
                pars.push({
                    label: unparsed[i]
                })
            }

            last_function.push({
                'name': func_sign,
                'argn': 0,
                'pars': pars
            });
        //}
        return {
            signatures: [
                {
                    label: func_sign, 
                    parameters: pars,
                    activeParameter: 0
                }
            ]
        }
    }
    else if (signatureHelpParms.context?.triggerCharacter === ',') {
        if (last_function.length == 0) {
            return null;
        }
        const lf = last_function[last_function.length-1];
        const newarg = Math.min(lf['argn'] + 1, lf['pars'].length - 1);

        last_function[last_function.length - 1]['argn'] = newarg;

        return {
            signatures: [
                {
                    label: lf['name'], 
                    parameters: lf['pars'],
                    activeParameter: newarg
                }
            ]
        }
    }
    else if (signatureHelpParms.context?.triggerCharacter === ')') {
        if (last_function.length == 0) {
            return null;
        }
        last_function.pop();
        if (last_function.length == 0) {
            return null;
        }
        const lf = last_function[last_function.length-1];
        return {
            signatures: [
                {
                    label: lf['name'], 
                    parameters: lf['pars'],
                    activeParameter: lf['argn']
                }
            ]
        }
    }
    else {
        const lf =  last_function[last_function.length-1];

        const line = readDocLine(signatureHelpParms.position.line);

        if (line[signatureHelpParms.position.character - 1] == ')') {
            if (last_function.length == 0) {
                return null;
            }
            last_function.pop();
            if (last_function.length == 0) {
                return null;
            }
            const lf = last_function[last_function.length-1];
            return {
                signatures: [
                    {
                        label: lf['name'], 
                        parameters: lf['pars'],
                        activeParameter: lf['argn']
                    }
                ]
            }
        }
        else {
            var noCommas = 0;
            var noPars = 0;

            for (let i = signatureHelpParms.position.character - 1; i >= 0; --i) {
                if (line[i] == '(') {
                    if (noPars == 0) {
                        break;
                    }
                    else {
                        --noPars;
                    }
                }
                if (line[i] == ')') {
                    ++noPars;
                }
                if (noPars == 0 && line[i] == ',') {
                    ++noCommas;
                }
            }

            const newarg = Math.min(noCommas, lf['pars'].length - 1);
            last_function[last_function.length - 1]['argn'] = newarg;

            return {
                signatures: [
                    {
                        label: lf['name'], 
                        parameters: lf['pars'],
                        activeParameter: newarg
                    }
                ]
            }
        }
    }
});

function readWordBefore(line: string, position: number, include = false) {
    if (!include) {
        --position;
    }
    if (position < 0) {
        return '';
    }
    var composeWord = '';
    for (let i = position; i >= 0; --i) {
        if (!alphanum.includes(line[i])) {
            break;
        }
        composeWord += line[i];
    }
    return [...composeWord].reverse().join("");
}

function readWordAfter(line: string, position: number, include = false) {
    if (!include) {
        ++position;
    }
    if (position > line.length - 1) {
        return '';
    }
    var composeWord = '';
    for (let i = position; i < line.length; ++i) {
        if (!alphanum.includes(line[i])) {
            break;
        }
        composeWord += line[i];
    }
    return composeWord;
}

function readWord(line: string, position: number) {
    return readWordBefore(line, position, true) + readWordAfter(line, position);
}

function readDocLine(line: number) {
    const txt : string = cachedDoc;
    return txt.replaceAll('\r', '').split('\n')[line];
}

// -----------------------------------------------------------------------------------------

// SHOW DEFINITION OF SYMBOL

// AICI VSCODE NE DA POSITION.CHARACTER CA 0 IN LOC DE 1 :)
connection.onDefinition(async (definitionParams): Promise<any> => {
    const docLine = readDocLine(definitionParams.position.line);

    if (!letters.includes(docLine[definitionParams.position.character])) {
        if (definitionParams.position.character > 0 && !letters.includes(docLine[definitionParams.position.character - 1])) {
            return null;
        }
        else {
            --definitionParams.position.character;
        }
    }

    const varname = readWord(docLine, definitionParams.position.character - 1);

    let isFunc = false;
    
    for (let i = definitionParams.position.character + varname.length; i < docLine.length; ++i) {
        if (docLine[i] == ' ' || docLine[i] == '\t') {
            continue;
        }
        if (docLine[i] == '(') {
            isFunc = true;
        }
        else {
            break;
        }
    }

    let result = [];

    if (isFunc) {
        result = await serverComm.writeCommand('where-f ' + varname + '\n');
    }
    else {
        result = await serverComm.writeCommand('where-v ' + definitionParams.position.line + ' ' + varname + '\n');
    }

    return {
        uri: definitionParams.textDocument.uri,
        range: {
            start: {
                line: parseInt(result[0]) - 1,
                character: 0
            },
            end: {
                line: parseInt(result[0]) - 1,
                character: getNameOfDefinition(parseInt(result[0]) - 1).length
            }
        }
    }
});

function getNameOfDefinition(line: number) {
    const docLine = cachedDoc.replaceAll('\r', '').split('\n')[line].trim();
    let str = '';
    for (let i = 0; i < docLine.length; ++i) {
        if (!alphanum.includes(docLine[i])) {
            return str;
        }
        str += docLine[i];
    }
    return str;
}

// -----------------------------------------------------------------------------------------

// HOVER

connection.onHover(async (hoverParams): Promise<any> => {
    const docLine = readDocLine(hoverParams.position.line);

    if (!letters.includes(docLine[hoverParams.position.character])) {
        if (hoverParams.position.character > 0 && !letters.includes(docLine[hoverParams.position.character - 1])) {
            return null;
        }
        else {
            --hoverParams.position.character;
        }
    }

    const varname = readWord(docLine, hoverParams.position.character - 1);

    let isFunc = false;
    
    for (let i = hoverParams.position.character + varname.length; i < docLine.length; ++i) {
        if (docLine[i] == ' ' || docLine[i] == '\t') {
            continue;
        }
        if (docLine[i] == '(') {
            isFunc = true;
        }
        else {
            break;
        }
    }

    if (isFunc) {
        const result = await serverComm.writeCommand('function ' + varname + '\n');
        const func_sign = result[0].replace('\r', '').replace('\n', '')

        return {
            contents: {
                language: "java",
                value: func_sign
            }
        }
    }
    else {
        return null;
    }
});

// -----------------------------------------------------------------------------------------

// FIND ALL REFERENCES

connection.onReferences(async (referenceParams): Promise<any> => {
    const docLine = readDocLine(referenceParams.position.line);

    if (!letters.includes(docLine[referenceParams.position.character])) {
        if (referenceParams.position.character > 0 && !letters.includes(docLine[referenceParams.position.character - 1])) {
            return null;
        }
        else {
            --referenceParams.position.character;
        }
    }

    const varname = readWord(docLine, referenceParams.position.character - 1);

    let isFunc = false;
    
    for (let i = referenceParams.position.character + varname.length; i < docLine.length; ++i) {
        if (docLine[i] == ' ' || docLine[i] == '\t') {
            continue;
        }
        if (docLine[i] == '(') {
            isFunc = true;
        }
        else {
            break;
        }
    }

    const result = await serverComm.writeCommand('all-references ' + (referenceParams.position.line + 1) + ' ' + varname + (isFunc ? ' 1' : '') + '\n');

    result.shift();

    const ret = []

    for (let i = 0; i < result.length; ++i) {
        const line = result[i].split(' ');
        ret.push({
            uri: referenceParams.textDocument.uri,
            range: {
                start: {
                    line: parseInt(line[0]) - 1,
                    character: parseInt(line[1])
                },
                end: {
                    line: parseInt(line[0]) - 1,
                    character: parseInt(line[1]) + varname.length
                }
            }
        });
    }

    return ret;
});

// -----------------------------------------------------------------------------------------

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
