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

import { Socket } from 'net';

const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";

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
			}
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
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
// connection.onCompletion(
// 	async (_textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
// 		// The pass parameter contains the position of the text document in
// 		// which code complete got requested. For the example we ignore this
// 		// info and always provide the same completion items.

// 		let result: String = await communicateWithServer('getVars', (_textDocumentPosition.position.line+1) + " " + makeText(documents.get(_textDocumentPosition.textDocument.uri)?.getText() || ":(") + "\n");
// 		console.log("VARS-START");
// 		console.log((_textDocumentPosition.position.line+1));
// 		console.log(result);
// 		console.log("VARS-END");
// 		let vars = result.split('\n');
// 		vars.shift();
// 		vars.pop();		
// 		let autoc = [
// 			{
// 				label: 'var',
// 				kind: CompletionItemKind.Text,
// 				data: 1
// 			},
// 			{
// 				label: 'autocomplete_test',
// 				kind: CompletionItemKind.Text,
// 				data: 2
// 			}
// 		];

// 		for(let i = 0; i < vars.length; ++i) {
// 			autoc.push({
// 				label: vars[i].replace('\n', '').replace('\r', ''),
// 				kind: CompletionItemKind.Text,
// 				data: i + 3
// 			});
// 		}

// 		console.log(autoc);
		

// 		return autoc;
// 	}
// );

// // This handler resolves additional information for the item selected in
// // the completion list.
// connection.onCompletionResolve(
// 	(item: CompletionItem): CompletionItem => {
// 		if (item.data === 1) {
// 			item.detail = 'var details';
// 			item.documentation = 'Use \'var\' when declaring a new variable';
// 		} else if (item.data === 2) {
// 			item.detail = 'autocomplete_test title';
// 			item.documentation = 'autocomplete_test description';
// 		}
// 		return item;
// 	}
// );

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
