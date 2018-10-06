import * as fs from 'fs';
import { ClientManager } from './clientManager';
import { Common } from './common';
import { ExecJob } from './execJob';
import { ExecJobManager } from './execJobManager';
import { SerialJobJSON } from './interface';

class App {
    /** ジョブ実行マネージャ */
    private ejm: ExecJobManager;
    /** クライアントマネージャ */
    private cm: ClientManager;

    /**
     * アプリケーションの作成を行います。
     */
    constructor() {
        const config = JSON.parse(fs.readFileSync('./config/server.json', 'utf-8'));
        this.cm = new ClientManager(config.ip, config.port, config.namespace);
        this.ejm = new ExecJobManager();
        this.init();
    }

    public start(): void {
        this.cm.open();
    }

    public stop(): void {
        this.cm.close();
    }

    public restart(): void {
        this.stop();
        this.start();
    }

    /**
     * 各種イベント登録を行います
     */
    private init(): void {
        // クライアントマネージャ側のイベント処理登録
        this.cm.events.on(Common.EVENT_RECEIVE_SEND_JOB, (data: SerialJobJSON, ack: Function) => { this.receiveSendJob(data, ack); });
        this.cm.events.on(Common.EVENT_RECEIVE_KILL_JOB, (data: SerialJobJSON, ack: Function) => { this.receiveKillJob(data, ack); });

        // 実行ジョブマネージャ側のイベント処理登録
        this.ejm.events.on(Common.EVENT_EXEC_ERROR, (job: ExecJob, onAck: Function) => { this.execError(job, onAck); });
        this.ejm.events.on(Common.EVENT_EXEC_SUCCESS, (job: ExecJob, onAck: Function, stdout: string, stderr: string) => { this.execSuccess(job, onAck, stdout, stderr); });
        this.ejm.events.on(Common.EVENT_EXEC_KILLED, (job: ExecJob, onAck: Function) => { this.execKilled(job, onAck); });
    }

    /**
     * ジョブ受信時の処理です。
     * 処理が正常に開始したらコールバックでtrueを返します。falseの場合はなんらかのエラーが発生しています。
     * @param data 受信したSerialJobJSON
     * @param ack サーバーに返すAck
     */
    private receiveSendJob(data: SerialJobJSON, ack: Function): void {
        const isStart = this.ejm.putExecJob(data);
        if (isStart) this.ejm.execJob(data.serial);
        ack(isStart);
    }

    /**
     * ジョブ強制終了受信時の処理です。
     * @param data 受信したSerialJobJSON
     * @param ack サーバーに返すAck
     */
    private receiveKillJob(data: SerialJobJSON, ack: Function): void {
        ack(this.ejm.killJob(data.serial));
    }

    /**
     * ジョブ失敗時の後処理です。
     * @param job 対象のジョブ
     * @param onAck コールバック
     */
    private execError(job: ExecJob, onAck: Function): void {
        this.cm.putDataHeaderAndSendJob(job, Common.EVENT_EXEC_ERROR, onAck);
    }

    /**
     * ジョブ成功時の後処理です。
     * @param job 対象のジョブ
     * @param onAck コールバック
     * @param stdout 標準出力
     * @param stderr 標準エラー出力
     */
    private execSuccess(job: ExecJob, onAck: Function, stdout: string, stderr: string): void {
        this.cm.putDataHeaderAndSendJob(job, Common.EVENT_EXEC_SUCCESS, onAck);
        Common.trace(Common.STATE_DEBUG, `stdout=${stdout}, stderr=${stderr}`);
    }

    /**
     * ジョブ強制終了の後処理です。
     * @param job 対象のジョブ
     * @param onAck コールバック
     */
    private execKilled(job: ExecJob, onAck: Function): void {
        this.cm.putDataHeaderAndSendJob(job, Common.EVENT_EXEC_KILLED, onAck);
    }
}

const app = new App();
try {
    app.start();
} catch (error) {
    Common.trace(Common.STATE_ERROR, error.stack);
}
