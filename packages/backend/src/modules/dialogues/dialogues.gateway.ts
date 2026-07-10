import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../../common/auth/jwt-payload.interface';

/**
 * `/conversations/stream` from 06 Engineering — pushes new messages and
 * status changes to the panel's live Dialogues feed. Each socket joins a
 * room scoped to its org so tenants never see each other's traffic even at
 * the transport layer, not just via REST/RLS.
 */
@WebSocketGateway({ namespace: '/conversations/stream', cors: { origin: '*' } })
export class DialoguesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(DialoguesGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(socket: Socket) {
    const token = (socket.handshake.auth?.token as string) || (socket.handshake.query?.token as string);
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      socket.join(`org:${payload.orgId}`);
    } catch {
      this.logger.warn('WS connection rejected: invalid token');
      socket.disconnect(true);
    }
  }

  handleDisconnect() {
    // no-op; socket.io cleans up room membership automatically
  }

  emitToOrg(orgId: string, event: string, payload: unknown) {
    this.server?.to(`org:${orgId}`).emit(event, payload);
  }
}
