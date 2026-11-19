import { describe, expect, it } from "vitest";
import { marketState } from "@/lib/market-hours";

describe("horario de bolsas", () => {
  it("jueves 19/11/2026 11:00 BRT: B3 abierta hasta 18:00, NY abierta desde 11:30", () => {
    const now = new Date("2026-11-19T14:00:00Z"); // 11:00 en Brasília, 9:00 en Nueva York
    const b3 = marketState("b3", now);
    expect(b3.status).toBe("open");
    expect(b3.hoursHome).toBe("10:00–18:00");
    expect(b3.next).toBe("fecha em 7h");
    const ny = marketState("nyse", now);
    expect(ny.status).toBe("closed");
    expect(ny.next).toBe("abre em 30 min");
    expect(ny.hoursHome).toBe("11:30–18:00");
  });
  it("viernes 20/11/2026: feriado en B3, Nueva York abre", () => {
    const now = new Date("2026-11-20T15:00:00Z");
    const b3 = marketState("b3", now);
    expect(b3.status).toBe("closed");
    expect(b3.closedReason).toBe("Feriado: Consciência Negra");
    expect(b3.next).toBe("abre seg 10:00");
    expect(marketState("nasdaq", now).status).toBe("open");
  });
  it("con horario de verano en EE.UU., B3 cierra a las 17:00 y NY abre 10:30 en Brasília", () => {
    const now = new Date("2026-06-10T12:00:00Z"); // 9:00 BRT
    const b3 = marketState("b3", now);
    expect(b3.hoursHome).toBe("10:00–17:00");
    expect(b3.next).toBe("abre em 1h");
    expect(marketState("nyse", now).hoursHome).toBe("10:30–17:00");
  });
  it("cierre anticipado después de Acción de Gracias y apertura del día siguiente", () => {
    expect(marketState("nyse", new Date("2026-11-27T16:00:00Z")).hoursHome).toBe("11:30–15:00");
    expect(marketState("nyse", new Date("2026-11-19T23:00:00Z")).next).toBe("abre amanhã 11:30");
  });
});
