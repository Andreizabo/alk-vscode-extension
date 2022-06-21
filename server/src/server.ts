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
import * as os from 'os';

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
    if (os.type() === 'Windows_NT')
    {
        serverComm.start(__dirname + "\\..\\..\\media\\alk\\alkls.bat");
    }
    else
    {
        serverComm.start(__dirname + "/../../media/alk/alkls.sh");
    }
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
                triggerCharacters: [ '(', ')', ',',  ]
            },
            definitionProvider: true,
            hoverProvider: true,
            referencesProvider: true,
            documentFormattingProvider: true
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
let cachedErrs : number = 0;

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
        validateTextDocument(result, change.document);
    }
    console.log('Hello');
});

async function validateTextDocument(errrs: string[], textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	//const settings = await getDocumentSettings(textDocument.uri);

	let problems = 0;
	const diagnostics: Diagnostic[] = [];	
	
	errrs.pop();	

	for(let i = 0; i < errrs.length && problems < 2000; ++i) {
        if (!errrs[i].includes(':') || !errrs[i].includes(' ')) {
            continue;
        }
		++problems;
		const line = parseInt(errrs[i].split(':')[0].trim());
        const afterPt = errrs[i].split(':')[1].trim().split(' ');
        const chr = parseInt(afterPt[0].trim());
        afterPt.shift();
        const msg = afterPt.join(' ').trim();
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: {
                    line: line - 1,
                    character: 0
                },
				end: {
                    line: line - 1,
                    character: readDocLine(line - 1).length
                }
			},
			message: errrs[i],
			source: 'Alk'
		};
		diagnostics.push(diagnostic);
	}
    cachedErrs = diagnostics.length;
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

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
    const line = signatureHelpParms.position.line;
    const character = signatureHelpParms.position.character;
    let noCommas = 0;
    let noPars = 0;
    let func_index = 0;

    let ln = readDocLine(line);

    for (let i = character - 1; i >= 0; --i) {
        if (ln[i] == '(') {
            if (noPars == 0) {
                func_index = i;
                break;
            }
            else {
                --noPars;
            }
        }
        if (ln[i] == ')') {
            ++noPars;
        }
        if (noPars == 0 && ln[i] == ',') {
            ++noCommas;
        }
    }

    while ([' ', '\t'].includes(ln[func_index--]));

    const func_name = readWordBefore(ln, func_index, true);

    if (func_name.length == 0 || ['if', 'while', 'else', 'for', 'repeat', 'foreach', 'forall', 'do'].includes(func_name.trim())) {
        return null;
    }

    const result = await serverComm.writeCommand('function ' + func_name + '\n');

    if (result[0].startsWith('No function')) {
        return null;
    }

    const func_sign = result[0].replace('\r', '').replace('\n', '');

    const pars = [];
    const unparsed = func_sign.split('(')[1].replace(')', '').replace(' ', '').replace('\t', '').split(',');
    for (let i = 0; i < unparsed.length; ++i) {
        pars.push({
            label: unparsed[i]
        })
    }

    return {
        signatures: [
            {
                label: func_sign, 
                parameters: pars,
                activeParameter: noCommas
            }
        ]
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
    const txtSplit = txt.replaceAll('\r', '').split('\n');
    if (line >= txtSplit.length) {
        return '';
    }
    return txtSplit[line];
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
    
    for (let i = definitionParams.position.character + readWordAfter(docLine, definitionParams.position.character-1).length; i < docLine.length; ++i) {
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
    
    for (let i = hoverParams.position.character + readWordAfter(docLine, hoverParams.position.character-1).length; i < docLine.length; ++i) {
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
    
    for (let i = referenceParams.position.character + readWordAfter(docLine, referenceParams.position.character-1).length; i < docLine.length; ++i) {
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

// FORMAT

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
        (stripped.startsWith("for") && !stripped.startsWith("foreach")) ||
        stripped.startsWith("forall");
}
function isFunction(line: string, index: number) {
    for (let i = index; i < line.length; ++i) {
        if (line[i] == ' ' || line[i] == '\t') {
            return false;
        }
        if (line[i] == '(') {
            return true;
        }
    }
    return false;
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
        if (line[i] === '"') {
            i += line.substring(i + 1).indexOf('"');
            ++i;
        }
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

                if (line.substring(i).startsWith('foreach')) {
                    if (line.substring(i).indexOf(';') > -1 && (line.substring(i).indexOf('{') === -1 || line.substring(i).indexOf(';') < line.substring(i).indexOf('{'))) {
                        i += line.substring(i).indexOf(';');
                    }
                    else {
                        i += line.substring(i).indexOf('{');
                        --i;
                    }
                }
                else if (conditional(line.substring(i))) {
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
                    if (isFunction(line, i)) {
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
                // line = insertAt(line, '\n' + makeTabs(tabs), i);
                // ++tabs;
                // i += tabs;
                // len += tabs;
            }
            else if (line[i] === ')') {
                --expFuncPhar;
                // if (i === 0) {
                //     line = insertAt(line, makeTabs(tabs), i);
                //     i += tabs;
                //     len += tabs;
                // }
                if (expFuncPhar == 0 && line.substring(i).indexOf('{') !== -1 && line.substring(i).indexOf(';') > line.substring(i).indexOf('{')) {
                    while (line[++i] != '{');
                    --i;
                }
                else if (line[i + 1] == ';') {
                    lastWasntInstr = true;
                    ++i;
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
function inString(line: string, index: number) {
    let noLeft = 0;
    let noRight = 0;

    for (let i = 0; i < line.length; ++i) {
        if (line[i] === '"') {
            if (i < index) {
                ++noLeft;
            }
            else {
                ++noRight;
            }
        }
    }

    return noLeft % 2 == 1 && noRight % 2 == 1;
}
function spacing(line: string) {
    let doubleSpace = ['+', '-', '*', ':', '/', '=', '<', '>', "+=", "-=", '*=', "/=", "==", "<=", ">="];
    let singleSpace = [';', ',', '.', "++", "--"];
    for (var symbol of doubleSpace) {
        let index = getPosition(line, symbol, 1);
        let i = 1;
        while (index !== -1 && index < line.length) {
            if (!inString(line, index)) {
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
function inBigComment(doc: string, index: number) {
    let noStart = 0;
    let noEnd = 0;
    for (let i = 0; i < index - 1; ++i) {
        if (doc[i] === '/' && doc[i + 1] === '*') {
            ++noStart;
        }
        else if (((i > 0 && doc[i - 1] !== '/') || i == 0) && doc[i] === '*' && doc[i + 1] === '/') {
            ++noEnd;
        }
    }
    return noStart > noEnd;
}
function findAnchor(doc: string, index: number, len: number) {
    let bef = 0;
    let befChr = '';
    for (let i = index; i > 0; --i) {
        if (![' ', '\n', '\t'].includes(doc[i])) {
            befChr = doc[i];
            break;
        }
        else {
            if (doc[i] == '\n') {
                ++bef;
            }
        }
    }
    let aft = 0;
    for (let i = index + len; i < doc.length; ++i) {
        if (![' ', '\n', '\t'].includes(doc[i])) {
            break;
        }
        else {
            if (doc[i] == '\n') {
                ++aft;
            }
        }
    }
    bef = Math.min(2, bef);
    aft = Math.min(2, aft);

    return {
        pref: bef === 2 ? '\n\n' : bef === 1 ? '\n' : '',
        suff: aft === 2 ? '\n' : '',
        type: befChr,
        no: countChar(doc.substring(0, index), befChr)
    }
}
function getComms(doc: string) {
    doc = doc.replaceAll('\r', '');
    const lines = doc.split('\n');
    const comms = [];
    let additive = 0;
    for (let i = 0; i < lines.length; ++i) {
        if (lines[i].includes('//') && !inBigComment(doc, additive + lines[i].indexOf('//'))) {
            const anchor = findAnchor(doc, additive + lines[i].indexOf('//') - 1, lines[i].substring(lines[i].indexOf('//')).length + 1);
            comms.push({
                comm: lines[i].substring(lines[i].indexOf('//')),
                suff: anchor['suff'],
                pref: anchor['pref'],
                type: 'line',
                anchor: anchor['type'],
                anchorNo: anchor['no'],
                pos: additive + lines[i].indexOf('//')
            });
        }
        additive += lines[i].length;
        ++additive;
    }
    let incom = false;
    let inline = false;
    let idx = -1;
    let cm = '';
    for (let i = 0; i < doc.length - 1; ++i) {
        if (doc[i] === '/' && doc[i + 1] === '*') {
            if (!inline && !incom) {
                idx = i;
                incom = true;
                cm = '/*';
                ++i;
            }
        }
        else if (((i > 0 && doc[i - 1] !== '/') || i == 0) && doc[i] === '*' && doc[i + 1] === '/') {
            if (incom) {
                const anchor = findAnchor(doc, idx - 1, i - idx + 1);
                comms.push({
                    comm: cm + '*/',
                    suff: anchor['suff'],
                    pref: anchor['pref'],
                    type: 'multi',
                    anchor: anchor['type'],
                    anchorNo: anchor['no'],
                    pos: idx
                });
                incom = false;
                ++i;
            }
        }
        else {
            if (incom) {
                cm += doc[i];
            }
            else {
                if (doc[i] === '/' && doc[i + 1] === '/') {
                    inline = true;
                }
                else if (doc[i] === '\n') {
                    inline = false;
                }
            }
        }
    }
    return comms;
}
function rmComms(doc: string) {
    let hasComms = false;
    let newDoc = doc;
    do {
        hasComms = false;
        let start = -1;
        let finish = -1;
        for (let i = newDoc.length; i > 1; --i) {
            if (newDoc[i - 1] === '*' && newDoc[i] === '/') {
                finish = i;
                break;
            }
        }
        for (let i = finish - 1; i > 0; --i) {
            if (newDoc[i - 1] === '/' && newDoc[i] === '*') {
                start = i - 1;
                break;
            }
        }
        if (start !== -1) {
            newDoc = newDoc.replaceAll(newDoc.substring(start, finish + 1), '');
            hasComms = true;
        }
    } while (hasComms);

    newDoc = newDoc.split('\n').map(line => line.replace(/\/\/.*/, '')).join('\n');

    return newDoc;
}
function putComms(doc: string, comms: any[]) {
    comms = comms.sort((a, b) => a['pos'] - b['pos']);
    let newDoc = doc;

    let handleStart = 0;
    for (let i = comms.length - 1; i >= 0; --i) {
        const cm = comms[i];
        if (cm['anchorNo'] !== -1) {
            continue;
        }
        else {
            if (handleStart == 0) {
                handleStart = i + 1;
            }
            newDoc = insertAt(newDoc, cm['pref'] + cm['comm'] + cm['suff'] + '\n', 0);
        }
    }

    for (let i = handleStart; i < comms.length; ++i) {
        const cm = comms[i];
        const index = getPosition(newDoc, cm['anchor'], cm['anchorNo']);
        const tabsIdx = doc.substring(index).indexOf('\t');
        let tabs = '';
        for (let j = tabsIdx; j < doc.length; ++j) {
            if (doc[j] === '\t') {
                tabs += '\t';
            }
            else {
                break;
            }
        }
        newDoc = insertAt(newDoc, cm['pref'] + tabs + cm['comm'] + cm['suff'], index + newDoc.substring(index).indexOf('\n'));
    }

    return newDoc;
}

connection.onDocumentFormatting(formattingParams => {
    if (cachedErrs > 0) {
        return null;
    }
    const comms = getComms(cachedDoc);
    const uncommented = rmComms(cachedDoc);
    const document = uncommented.split('\n');
    const linesNo = cachedDoc.split('\n').length;
    let operations = [];
    let lineArr: string[] = [];
    for (let i = 0; i < linesNo; ++i) {
        lineArr.push(document[i]);
    }
    operations.push({
        newText: '',
        range: {
            start: {
                line: 0,
                character: 0
            },
            end: {
                line: linesNo + 1,
                character: 0
            }
        }
    });

    let superLine = lineArr.join(" ");
    superLine = handleBlock(superLine, 0, 0, 0, 0, 0)["line"];
    superLine = spacing(superLine);
    if (superLine[0] == '\n') {
        superLine = superLine.substring(1);
    }
    superLine = putComms(superLine, comms);
    operations.push({
        newText: superLine,
        range: {
            start: {
                line: 0,
                character: 0
            },
            end: {
                line: 0,
                character: 0
            }
        }
    });
    return operations;
});

// -----------------------------------------------------------------------------------------

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
