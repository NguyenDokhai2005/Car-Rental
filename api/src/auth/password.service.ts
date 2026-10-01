import { Algorithm, hash, verify } from "@node-rs/argon2";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

// Tham số theo khuyến nghị tối thiểu của OWASP cho argon2id: 19 MiB, 2 vòng, 1 luồng.
const ARGON2_OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

@Injectable()
export class PasswordService {
  // Băm mật khẩu giả một lần để đăng nhập với email không tồn tại tốn thời gian ngang đăng nhập thật,
  // tránh lộ email nào đã đăng ký qua độ trễ phản hồi.
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string | null, password: string): Promise<boolean> {
    const target = passwordHash ?? (await this.getDummyHash());
    try {
      const matches = await verify(target, password);
      return passwordHash !== null && matches;
    } catch {
      return false;
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hash(randomBytes(16).toString("hex"));
    return this.dummyHash;
  }
}
