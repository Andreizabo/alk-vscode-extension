import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import {
	Logger, logger,
	LoggingDebugSession,
	InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent,
	ProgressStartEvent, ProgressUpdateEvent, ProgressEndEvent, InvalidatedEvent,
	Thread, StackFrame, Scope, Source, Handles, Breakpoint, MemoryEvent
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { AlkRuntime, IRuntimeBreakpoint } from './alkRuntime';

export class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory 
{
    private _alkPath: string;

    public constructor(extensionContext: vscode.ExtensionContext)
    {
        const alkRunScript = os.type() === 'Windows_NT' ? 'alki.bat' : 'alki.sh';
        this._alkPath = path.join(extensionContext.extensionUri.fsPath, 'media', 'alk', alkRunScript);
    }

	createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        console.log("Create adapter");
		return new vscode.DebugAdapterInlineImplementation(new AlkDebugSession(this._alkPath));
	}
}

export class AlkConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) 
        {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === 'alk') 
            {
				config.type = 'alk';
				config.name = 'Launch';
				config.request = 'launch';
				config.mainFile = '${file}';
			}
		}

		if (!config.mainFile) {
			return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
				return undefined;	// abort launch
			});
		}

		return config;
	}
}

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments 
{
	mainFile: string;
}

interface IAttachRequestArguments extends ILaunchRequestArguments { }

export class AlkDebugSession extends LoggingDebugSession
{
	private static threadID = 1;
    private _runtime: AlkRuntime;
    private _configurationDone: boolean = false;
    private _alkPath: string;
	private _mainFile: string = "";
	private _mainFileSource: Source | undefined;

    public constructor(alkPath: string)
    {
        super('alk-debug.txt');
		this.setDebuggerLinesStartAt1(true);
		this.setDebuggerColumnsStartAt1(true);
        console.log("Create session");
        this._runtime = new AlkRuntime();
        this._runtime.on('stopOnEntry', () => {
			console.log('stopOnEntry');
            this.sendEvent(new StoppedEvent('entry', AlkDebugSession.threadID));
        });
		this._runtime.on('stopOnStep', () => {
			console.log('stopOnStep');
			this.sendEvent(new StoppedEvent('step', AlkDebugSession.threadID));
		});
		this._runtime.on('stopOnBreakpoint', () => {
			console.log("Stop on breakpoint");
			this.sendEvent(new StoppedEvent('breakpoint', AlkDebugSession.threadID));
		});
		this._runtime.on('breakpointValidated', (bp: IRuntimeBreakpoint) => {
			console.log("Breakpoint validated");
			this.sendEvent(new BreakpointEvent('changed', { verified: bp.verified, id: bp.id } as DebugProtocol.Breakpoint));
		});
		this._runtime.on('output', (type, text) => 
		{
			// important stdout stderr, console
			const e: DebugProtocol.OutputEvent = new OutputEvent(text, type);
			this.sendEvent(e);
		});
		this._runtime.on('end', () => {
			console.log("End");
			setTimeout(() => {
				this._runtime.printAll();
				this.sendEvent(new TerminatedEvent());
			}, 100);
			
		});
        this._alkPath = alkPath;
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void 
    {
        console.log("Init session");
        response.body = response.body || {};
		response.body.supportsConfigurationDoneRequest = true;
		// response.body.supportsConditionalBreakpoints?: boolean;
		response.body.supportsEvaluateForHovers = true;
		response.body.supportTerminateDebuggee = true;
		response.body.supportsBreakpointLocationsRequest = true;
		response.body.supportsSteppingGranularity = true;
		response.body.supportsStepBack = true;

        this.sendResponse(response);

        this.sendEvent(new InitializedEvent());
    }

    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void 
    {
		super.configurationDoneRequest(response, args);

		this._configurationDone = true;
	}

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void 
    {
        // aici o sa dau kill la debugger
		this._runtime.terminate();
		console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
	}

	protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) 
    {
		return this.launchRequest(response, args);
	}

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) 
    {
        console.log("Launch session");
		logger.setup(Logger.LogLevel.Verbose, false);

		while (this._configurationDone === false)
        {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // pe aici o sa trebuiasca sa fac o gramada de check-uri, runtime nu trebuie sa aiba treaba asta

		this._mainFile = args.mainFile;
		this._mainFileSource = new Source(this._mainFile);
		await this._runtime.start(this._alkPath, args.mainFile);

        // daca avem eroare
		if (false) 
        {
			// simulate a compile/build error in "launch" request:
			// the error should not result in a modal dialog since 'showUser' is set to false.
			// A missing 'showUser' should result in a modal dialog.
			//this.sendErrorResponse(response, {
			//	id: 1001,
			//	format: `compile error: some fake error.`,
			//	showUser: args.compileError === 'show' ? true : (args.compileError === 'hide' ? false : undefined)
			//});
		} 
        else 
        {
			this.sendResponse(response);
		}
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void 
	{
		response.body = {
			threads: [
				new Thread(AlkDebugSession.threadID, "thread 1")
			]
		};
		this.sendResponse(response);
	}

	protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> 
	{
		const clientLines = args.lines || [];

		await this._runtime.clearBreakpoints();

		const breakpoints = clientLines.map(async l => {
			const { verified, line, id } = await this._runtime.setBreakpoint(this.convertClientLineToDebugger(l), args.source.path || '');
			const bp = new Breakpoint(verified, this.convertDebuggerLineToClient(line)) as DebugProtocol.Breakpoint;
			bp.id = id;
			return bp;
		});

		// send back the actual breakpoint positions
		response.body = {
			breakpoints: await Promise.all(breakpoints)
		};
		this.sendResponse(response);
	}

	protected breakpointLocationsRequest(response: DebugProtocol.BreakpointLocationsResponse, args: DebugProtocol.BreakpointLocationsArguments, request?: DebugProtocol.Request): void 
	{
		response.body = {
			breakpoints: [{
				line: args.line,
				column: this.convertDebuggerColumnToClient(1)
			}]
		};
		this.sendResponse(response);
	}

	protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): Promise<void>
	{
		const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
		const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
		const endFrame = startFrame + maxLevels;

		const stk = await this._runtime.stackTrace(startFrame, endFrame);

		response.body = {
			stackFrames: stk.frames.map((f, ix) => {
				const sf: DebugProtocol.StackFrame = {
					id: f.index,
					name: f.name,
					line: f.line,
					source: this._mainFileSource,
					column: 0
				};

				return sf;
			}),
			totalFrames: stk.count
		};
		this.sendResponse(response);
	}

	protected async continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): Promise<void> 
	{
		await this._runtime.continue();
		this.sendResponse(response);
	}

	protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): Promise<void> 
	{
		await this._runtime.next();
		this.sendResponse(response);
	}

	protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): Promise<void> 
	{
		await this._runtime.step();
		this.sendResponse(response);
	}

	protected async stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments, request?: DebugProtocol.Request): Promise<void>
	{
		await this._runtime.back();
		this.sendResponse(response);
	}

	protected async reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments, request?: DebugProtocol.Request): Promise<void> 
	{
		await this._runtime.back();
		this.sendResponse(response);
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void 
	{
		this._runtime.stepOut();
		this.sendResponse(response);
	}

	protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> 
	{
		let reply: string | undefined = await this._runtime.eval(args.expression);

		// de vazut ce facem cu var reference

		// if (args.expression.startsWith('$')) {
		// 	rv = this._runtime.getLocalVariable(args.expression.substr(1));
		// } else {
		// 	rv = new RuntimeVariable('eval', this.convertToRuntime(args.expression));
		// }

		// if (rv) {
		// 	const v = this.convertFromRuntime(rv);
		// 	response.body = {
		// 		result: v.value,
		// 		type: v.type,
		// 		variablesReference: v.variablesReference,
		// 		presentationHint: v.presentationHint
		// 	}
		response.body = {
			result: reply ? reply : `evaluate(context: '${args.context}', '${args.expression}')`,
			variablesReference: 0
		};

		this.sendResponse(response);
	}
}