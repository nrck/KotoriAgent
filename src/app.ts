import * as fs from 'fs';
import { ClientManager } from './clientManager';
import { Common } from './common';
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
        this.cm.events.on(Common.EVENT_RECEIVE_SEND_JOB, (data: SerialJobJSON, onAck: Function) => { this.receiveSendJob(data, onAck); });
        this.cm.events.on(Common.EVENT_RECEIVE_KILL_JOB, (data: SerialJobJSON, onAck: Function) => { this.receiveKillJob(data, onAck); });

        // 実行ジョブマネージャ側のイベント処理登録
        this.ejm.events.on(Common.EVENT_EXEC_ERROR, (job: SerialJobJSON, onAck: Function) => { this.execError(job, onAck); });
        this.ejm.events.on(Common.EVENT_EXEC_SUCCESS, (job: SerialJobJSON, stdout: string, stderr: string, onAck: Function) => { this.execSuccess(job, stdout, stderr, onAck); });
        this.ejm.events.on(Common.EVENT_EXEC_KILLED, (job: SerialJobJSON, onAck: Function) => { this.execKilled(job, onAck); });
    }

    /**
     * ジョブ受信時の処理です。
     * 処理が正常に開始したらコールバックでtrueを返します。falseの場合はなんらかのエラーが発生しています。
     * @param data 受信したSerialJobJSON
     * @param onAck サーバーに返すAck
     */
    private receiveSendJob(data: SerialJobJSON, onAck: Function): void {
        const isStart = this.ejm.putExecJob(data);
        if (isStart) this.ejm.execJob(data.serial, data.code);
        onAck(isStart);
    }

    /**
     * ジョブ強制終了受信時の処理です。
     * @param data 受信したSerialJobJSON
     * @param onAck サーバーに返すAck
     */
    private receiveKillJob(data: SerialJobJSON, onAck: Function): void {
        onAck(this.ejm.killJob(data.serial, data.code));
    }

    /**
     * ジョブ失敗時の後処理です。
     * @param job 対象のジョブ
     * @param onAck コールバック
     */
    private execError(job: SerialJobJSON, onAck: Function): void {
        this.cm.putDataHeaderAndSendJob(job, Common.EVENT_EXEC_ERROR, onAck);
    }

    /**
     * ジョブ成功時の後処理です。
     * @param job 対象のジョブ
     * @param onAck コールバック
     * @param stdout 標準出力
     * @param stderr 標準エラー出力
     */
    private execSuccess(job: SerialJobJSON, stdout: string, stderr: string, onAck: Function): void {
        this.cm.putDataHeaderAndSendJob(job, Common.EVENT_EXEC_SUCCESS, onAck);
        Common.trace(Common.STATE_DEBUG, `stdout=${stdout}, stderr=${stderr}`);
    }

    /**
     * ジョブ強制終了の後処理です。
     * @param job 対象のジョブ
     * @param onAck コールバック
     */
    private execKilled(job: SerialJobJSON, onAck: Function): void {
        this.cm.putDataHeaderAndSendJob(job, Common.EVENT_EXEC_KILLED, onAck);
    }
}

const app = new App();
try {
    app.start();
} catch (error) {
    Common.trace(Common.STATE_ERROR, error.stack);
}
