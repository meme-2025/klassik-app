import { WebSocketGateway } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';

@WebSocketGateway()
export class GameGateway {
  private readonly logger = new Logger(GameGateway.name);
}
