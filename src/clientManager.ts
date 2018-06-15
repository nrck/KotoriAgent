import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as SocketIOClient from 'socket.io-client';
import { Common } from './common';
import { AgentJSON, DataHeaderJSON, HelloJSON, SendJobJSON } from './interface';

export class ClientManager {
    private static CLIENT_CONFIG = './config/config.json';
    private _socket: SocketIOClient.Socket;
    private _serverHost: string;
    private _port: number;
    private _namespace: string;
    private _agentName = '';
    private _shareKey = '';
    private _agentIP = '';
    private _events: EventEmitter;
    private _no: number;

    /**
     * クライアントマネージャーを作成します。
     * @param serverHost PoplarServerのホスト、またはIPアドレスを指定します。
     * @param port 接続ポートを指定します。
     * @param namespace 接続ネームスペースを指定します。デフォルトで"/"になります。
     * @param no パケットNo
     */
    constructor(serverHost: string, port: number, namespace?: string, no?: number) {
        this._serverHost = serverHost;
        this._port = port;
        this._events = new EventEmitter();
        this._namespace = namespace || '/';
        this._socket = SocketIOClient(`ws://${this.serverHost}:${this.port}${this.namespace}`, { 'autoConnect': false });
        this._no = no || 0;
        this.setAgentInfo();
        this.initClient();
    }


    public get agentName(): string {
        return this._agentName;
    }

    public get shareKey(): string {
        return this._shareKey;
    }

    public get agentIP(): string {
        return this._agentIP;
    }

    public get serverHost(): string {
        return this._serverHost;
    }

    public get port(): number {
        return this._port;
    }

    public get events(): EventEmitter {
        return this._events;
    }

    public get socket(): SocketIOClient.Socket {
        return this._socket;
    }

    public get namespace(): string {
        return this._namespace;
    }

    public get connected(): boolean {
        return this.socket.connected;
    }

    public get no(): number {
        this._no++;

        return this._no;
    }
    public setAgentInfo(): void {
        const file = JSON.parse(fs.readFileSync(ClientManager.CLIENT_CONFIG, 'utf8'));
        this._agentName = file.agentName;
        this._agentIP = file.ip;
        this._shareKey = file.sharekey;
    }

    /**
     * 初期化します
     */
    public initClient(): void {
        // SocketIOのAPI仕様みて

        // 接続時
        this.socket.on('connect', () => { this.connection(); });
        // this.socket.on('connect_error', (error: Error) => { this.connection(); });
        // this.socket.on('connect_timeout', (error: Error) => { this.connection(); });

        // 切断時
        this.socket.on(Common.EVENT_DISCONNECT, (reason: string) => { this.disconnect(reason); });
        // 承認電文（レスポンス）
        this.socket.on(Common.EVENT_HELLO, (data: HelloJSON) => { this.hello(data); });
        // ジョブの強制終了の受信
        this.socket.on(Common.EVENT_KILL_JOB, () => { this.connection(); });
        // ジョブの実行結果（これいる？
        this.socket.on(Common.EVENT_RESULT_JOB, () => { this.connection(); });
        // ジョブの実行の受信
        this.socket.on(Common.EVENT_SEND_JOB, (data: SendJobJSON) => { this.receiveJob(data); });
        this.open();
    }

    /**
     * ソケットを開きます。
     */
    public open(): void {
        if (this.socket.connected) return;
        this.socket.open();
        Common.trace(Common.STATE_INFO, `ws://${this.serverHost}:${this.port}${this.namespace}に接続を開始しました。`);
    }

    /**
     * クローズします。
     */
    public close(): void {
        if (this.socket.disconnected) return;
        this.socket.close();
        Common.trace(Common.STATE_INFO, `ws://${this.serverHost}:${this.port}${this.namespace}を切断しました。`);
        this.socket.removeAllListeners();
    }

    /**
     * コネクション接続時。
     */
    private connection(): void {
        // ログ
        Common.trace(Common.STATE_INFO, `${this.socket.io.uri}に接続しました。`);
        const data: AgentJSON = {
            'ipaddress': this.agentIP,
            'name': this.agentName,
            'sharekey': this.shareKey
        };
        this.socket.emit(Common.EVENT_HELLO, { 'data': data, 'header': this.createDataHeader(false, Common.ENV_SERVER_HOST, 'Hello') });
    }

    /**
     * 切断時にイベント発火し、Appへ通知します。
     * @param reason 切断理由
     */
    private disconnect(reason: string): void {
        Common.trace(Common.STATE_INFO, `${reason}のため、${this.socket.io.uri}から切断されました。`);
    }

    /**
     * Helloの結果を受けたときの処理
     * @param data 受信したHelloJSON
     */
    private hello(data: HelloJSON): void {
        // ここに自分じゃないときの処理を入れるか悩む
        if (data.header.type !== 'Hello') {
            Common.trace(Common.STATE_ERROR, `サーバ認証に失敗したため、${this.socket.io.uri}を切断します。`);
            this.close();

            return;
        }
        Common.trace(Common.STATE_INFO, 'サーバ認証に成功しました。');
    }

    private receiveJob(data: SendJobJSON): void {
        this.events.emit(Common.EVENT_SEND_JOB, data.data);
    }

    // private receiveKillJob(data: SendJobJSON): void {

    // }

    public createDataHeader(isResponse: false | [true, number], to: string, type: string): DataHeaderJSON {
        const header: DataHeaderJSON = {
            'from': Common.ENV_SERVER_HOST,
            'isResponse': isResponse,
            'no': this.no,
            'timestamp': new Date(),
            'to': to,
            'type': type
        };

        return header;
    }
}

