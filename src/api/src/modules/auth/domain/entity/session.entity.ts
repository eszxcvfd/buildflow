export class SessionEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
