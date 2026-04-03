import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://leanpilot.me', 'https://www.leanpilot.me']
      : ['http://localhost:3000', 'http://localhost:4001'],
    credentials: true,
  },
  namespace: '/shopfloor',
})
export class ShopfloorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ShopfloorGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Broadcast workstation status change to all connected clients */
  emitStatusChange(siteId: string, payload: {
    workstationId: string;
    workstationName: string;
    status: string;
    reasonCode?: string;
    notes?: string;
    operatorName?: string;
    timestamp: string;
  }) {
    this.server.emit(`status:${siteId}`, payload);
  }

  /** Broadcast production run event */
  emitRunEvent(siteId: string, payload: {
    workstationId: string;
    eventType: 'run_started' | 'run_closed' | 'flag';
    poNumber?: string;
    productName?: string;
    timestamp: string;
  }) {
    this.server.emit(`run:${siteId}`, payload);
  }
}
