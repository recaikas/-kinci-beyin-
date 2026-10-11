import { useState } from "react";
import type { GameView } from "@kader/game";

type ShopView = GameView["shops"][number];

export function ShopModal({ shop, view, onClose, onBuy, onSell, busy }: {
  shop: ShopView;
  view: GameView;
  onClose: () => void;
  onBuy: (itemKey: string, qty: number, haggle: boolean) => void;
  onSell: (itemKey: string, qty: number, haggle: boolean) => void;
  busy: boolean;
}) {
  const [haggle, setHaggle] = useState(false);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const inv = view.sheet.inventory;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${shop.name} dükkânı`}>
        <div className="row">
          <h2 className="grow" style={{ margin: 0 }}>{shop.name}</h2>
          <span className="chip gold">Kesende: {view.sheet.wallet}</span>
          <button className="btn small" onClick={onClose}>Kapat</button>
        </div>
        <div className="row" style={{ margin: "10px 0" }}>
          <button className={`btn small ${tab === "buy" ? "active" : ""}`} onClick={() => setTab("buy")}>Satın al</button>
          <button className={`btn small ${tab === "sell" ? "active" : ""}`} onClick={() => setTab("sell")}>Sat</button>
          <label className="row small grow" style={{ justifyContent: "flex-end" }}>
            <input type="checkbox" checked={haggle} onChange={(e) => setHaggle(e.target.checked)} /> Pazarlık et (İkna DC 15)
          </label>
        </div>
        <div className="list">
          {tab === "buy" && shop.items.map((i) => (
            <div key={i.key} className="li">
              <div className="name">{i.name}<small>stok {i.qty}</small></div>
              <span className="chip gold">{i.price}</span>
              <button className="btn small" disabled={busy || view.sheet.walletCp < i.priceCp} onClick={() => onBuy(i.key, 1, haggle)}>Al</button>
            </div>
          ))}
          {tab === "sell" && shop.buys.map((b) => {
            const item = inv.find((x) => x.key === b.key);
            if (!item) return null;
            return (
              <div key={b.key} className="li">
                <div className="name">{item.name}<small>sende {item.qty}{item.equipped ? " · kuşanılı" : ""}</small></div>
                <span className="chip gold">{b.price}</span>
                <button className="btn small" disabled={busy || b.priceCp <= 0} onClick={() => onSell(b.key, 1, haggle)}>Sat</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
