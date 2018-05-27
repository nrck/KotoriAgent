import { ChildProcess, execSync, execFile } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import { Common } from './common';

export class ExecJob {
    private _serial: string;
    private _jobcode: string;
    private _execFile: string;
    private _args?: string[];
    private _returnCode: string;
    private _exceptionMes: string;
    private process?: ChildProcess;
    private _events: EventEmitter = new EventEmitter();
    private _echorc: string;

    constructor(serial: string, jobcode: string, execFile: string, args?: string[]) {
        this._serial = serial;
        this._jobcode = jobcode;
        this._execFile = execFile;
        this._args = args || [];
        this._returnCode = '';
        this._exceptionMes = '';
        this._echorc = os.type().match('Windows_NT') !== null ? 'echo %ERRORLEVEL%' : 'echo $?';
    }

    public get serial(): string {
        return this._serial;
    }

    public get jobcode(): string {
        return this._jobcode;
    }

    public get execFile(): string {
        return this._execFile;
    }

    public get args(): string[] | undefined {
        return this._args;
    }

    public get returnCode(): string {
        return this._returnCode;
    }

    public set returnCode(value: string) {
        this._returnCode = value;
    }

    public get exceptionMes(): string {
        return this._exceptionMes;
    }

    public set exceptionMes(value: string) {
        this._exceptionMes = value;
    }

    public get events(): EventEmitter {
        return this._events;
    }

    public get echorc(): string {
        return this._echorc;
    }

    /**
     * ジョブの実行
     */
    public exec(): void {
        this.process = execFile(this.execFile, this.args, { 'maxBuffer': 400 * 1024 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error !== null) {
                this.returnCode = '500';
                this.exceptionMes = error.message;
                this.events.emit(Common.EVENT_EXEC_ERROR);

                return;
            }

            this.returnCode = execSync(this.echorc).toString();
            this.events.emit(Common.EVENT_EXEC_SUCCESS, stdout, stderr);
            Common.trace(Common.STATE_INFO, `ジョブが成功しました。（execFile：${this.execFile}、RC：${this.returnCode}）`);
            this.process = undefined;

        });
        Common.trace(Common.STATE_INFO, `ジョブを実行しました。（execFile：${this.execFile}、PID：${this.process.pid}）`);
    }

    public kill(): void {
        if (typeof this.process === 'undefined') {
            Common.trace(Common.STATE_ERROR, `ジョブはすでに終了しています。（execFile：${this.execFile}）`);

            return;
        }
        this.process.kill();
        this.returnCode = '-1';
        this.exceptionMes = 'KILL SIGNAL';
        this.events.emit(Common.EVENT_EXEC_KILLED);
        Common.trace(Common.STATE_ERROR, `ジョブを強制終了しました。（execFile：${this.execFile}、PID：${this.process.pid}）`);
        this.process = undefined;
    }
}
