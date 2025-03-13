import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { VmServiceClient } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

/**
 * Client for communicating with the Flutter VM Service Protocol
 * Documentation: https://github.com/dart-lang/sdk/blob/main/runtime/vm/service/service.md
 */
export class FlutterVmServiceClient implements VmServiceClient {
  private ws: WebSocket | null = null;
  private url: string;
  private connected = false;
  private messageQueue: Map<string, { resolve: Function; reject: Function }> = new Map();
  private eventEmitter = new EventEmitter();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Create a new VM Service client
   * @param port The port where the VM service is running
   * @param hostname The hostname of the VM service, defaults to localhost
   */
  constructor(
    private port: number,
    private hostname: string = 'localhost',
    private onDisconnect?: () => void
  ) {
    this.url = `ws://${hostname}:${port}/ws`;
  }

  /**
   * Connect to the VM service
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        logger.debug(`Connecting to VM service at ${this.url}`);
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          logger.debug(`Connected to VM service at ${this.url}`);
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const response = JSON.parse(data.toString());
            
            // Handle event
            if (response.type === 'Event') {
              this.eventEmitter.emit(response.event.kind, response.event);
              this.eventEmitter.emit(`${response.streamId}:${response.event.kind}`, response.event);
              return;
            }
            
            // Handle RPC response
            if (response.id && this.messageQueue.has(response.id)) {
              const { resolve, reject } = this.messageQueue.get(response.id)!;
              this.messageQueue.delete(response.id);
              
              if (response.error) {
                reject(new Error(`VM Service error: ${JSON.stringify(response.error)}`));
              } else {
                resolve(response.result);
              }
            }
          } catch (err) {
            logger.error('Error parsing VM service message', err);
          }
        });

        this.ws.on('error', (error) => {
          logger.error(`VM service error: ${error.message}`);
          if (!this.connected) {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          logger.debug(`VM service connection closed for ${this.url}`);
          this.connected = false;
          this.ws = null;
          
          // Clear all pending requests
          for (const [id, { reject }] of this.messageQueue.entries()) {
            reject(new Error('VM service connection closed'));
          }
          this.messageQueue.clear();
          
          if (this.onDisconnect) {
            this.onDisconnect();
          }
          
          // Try to reconnect unless max attempts reached
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
            logger.debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch((err) => {
                logger.error(`Reconnect failed: ${err.message}`);
              });
            }, delay);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the VM service
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Send a message to the VM service
   * @param method The method to call
   * @param params The parameters to send
   * @returns The response from the VM service
   */
  private async sendMessage(method: string, params: any = {}): Promise<any> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to VM service');
    }

    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.messageQueue.set(id, { resolve, reject });
      
      try {
        this.ws!.send(JSON.stringify(message));
      } catch (err) {
        this.messageQueue.delete(id);
        reject(err);
      }
      
      // Set timeout for request
      setTimeout(() => {
        if (this.messageQueue.has(id)) {
          this.messageQueue.delete(id);
          reject(new Error(`Request timed out: ${method}`));
        }
      }, 10000);
    });
  }

  /**
   * Get basic VM information
   */
  public async getVM(): Promise<any> {
    return this.sendMessage('getVM');
  }

  /**
   * Get information about an isolate
   * @param isolateId The ID of the isolate
   */
  public async getIsolate(isolateId: string): Promise<any> {
    return this.sendMessage('getIsolate', { isolateId });
  }

  /**
   * Get memory usage for an isolate
   * @param isolateId The ID of the isolate
   */
  public async getMemoryUsage(isolateId: string): Promise<any> {
    return this.sendMessage('getMemoryUsage', { isolateId });
  }

  /**
   * Get all isolates in the VM
   */
  public async getIsolates(): Promise<string[]> {
    const vm = await this.getVM();
    return vm.isolates.map((isolate: any) => isolate.id);
  }

  /**
   * Start listening to a stream
   * @param streamId The ID of the stream to listen to
   */
  public async streamListen(streamId: string): Promise<void> {
    await this.sendMessage('streamListen', { streamId });
  }

  /**
   * Call an extension method
   * @param method The extension method to call
   * @param params The parameters to send
   */
  public async callExtensionMethod(method: string, params: any = {}): Promise<any> {
    return this.sendMessage(method, params);
  }

  /**
   * Register a callback for stream events
   * @param streamId The ID of the stream
   * @param callback The callback to call when an event is received
   */
  public onEvent(streamId: string, callback: (event: any) => void): void {
    this.eventEmitter.on(streamId, callback);
  }

  /**
   * Capture a screenshot of the Flutter app
   */
  public async captureScreenshot(): Promise<string> {
    const result = await this.sendMessage('ext.flutter.screenshot', {});
    return result.screenshot;
  }
  
  /**
   * Trigger a hot reload of the Flutter app
   * @param isolateId The ID of the isolate
   * @param fullRestart Whether to do a full restart
   */
  public async hotReload(isolateId: string, fullRestart: boolean = false): Promise<any> {
    if (fullRestart) {
      return this.sendMessage('ext.flutter.restartApp', {});
    } else {
      return this.sendMessage('reloadSources', { isolateId });
    }
  }
} 