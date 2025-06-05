import { PriceData, AccountData } from '../types/websocket.types';

class WebSocketService {
    private ws: WebSocket | null = null;
    private url: string;

    constructor() {
        this.url = 'ws://localhost:3001';
    }

    public connect(
        onPrice: (data: PriceData) => void,
        onAccount: (data: AccountData) => void
    ): void {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('Connected to WebSocket');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'PRICE':
                        onPrice(data.payload);
                        break;
                    case 'ACCOUNT':
                        onAccount(data.payload);
                        break;
                    default:
                        console.log('Unknown message type:', data.type);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Try to reconnect after 5 seconds
            setTimeout(() => this.connect(onPrice, onAccount), 5000);
        };
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const wsService = new WebSocketService(); 