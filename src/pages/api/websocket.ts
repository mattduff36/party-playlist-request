import { NextApiRequest, NextApiResponse } from 'next';
import { Server as NetServer } from 'http';
import { wsManager } from '../../lib/websocket-server';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (res.socket.server.io) {
    console.log('WebSocket server already running');
  } else {
    console.log('Starting WebSocket server...');
    const httpServer: NetServer = res.socket.server as any;
    res.socket.server.io = wsManager.initialize(httpServer);
  }
  
  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};
