export interface Message { id: string; roomId: string; senderId: string; body: string; sequence: number; createdAt: string }
export interface MessengerBackend {
  listMessages(roomId: string, afterSequence?: number): Promise<Message[]>;
  sendMessage(input: {roomId: string; body: string; idempotencyKey: string}): Promise<Message>;
  subscribe(roomId: string, receive: (message: Message) => void): () => void;
}
// Adapter is deliberately unconfigured until identity and realtime proof passes.
export const backendStatus = 'unconfigured' as const;
