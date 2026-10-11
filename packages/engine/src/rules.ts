/**
 * Kampanya kuralları. RAW (kitaptaki saf kurallar) ile anlatıya zenginlik katan
 * ev kuralları arasında kampanya başına seçim yapılır. `campaigns.settings`
 * sütununda saklanır.
 */
export interface RuleOptions {
  /**
   * Kısmi başarı: DC'yi bu kadar ya da daha az farkla kaçıran kontrol
   * "başarı ama bedeli var" sayılır. 0 = kapalı (RAW).
   */
  partialSuccessMargin: number;
  /** DC'yi 10+ geçen/kaçıran kontrol kritik kademeye çıkar. */
  degreesOfSuccess: boolean;
  /** Kontrollerde doğal 20/1 kademeyi bir basamak kaydırır (RAW'da yok). */
  naturalStepsOnChecks: boolean;
  /** Oyuncu olmayan yaratıklar 0 HP'de doğrudan ölür (RAW: DM kararı). */
  monstersDieAtZero: boolean;
  /** Kritik vuruşta zarları ikiye katlamak yerine maks + bir atış. */
  critMaxPlusRoll: boolean;
  /** Bitkinlik uzun dinlenmede 1 azalır (yiyecek/içecek varsayımıyla). */
  longRestReducesExhaustion: boolean;
  /** Grup kontrolü: en az yarısı başarılıysa grup başarılı. */
  groupCheckHalf: boolean;
}

export const RAW_RULES: RuleOptions = {
  partialSuccessMargin: 0,
  degreesOfSuccess: false,
  naturalStepsOnChecks: false,
  monstersDieAtZero: true,
  critMaxPlusRoll: false,
  longRestReducesExhaustion: true,
  groupCheckHalf: true,
};

/** Varsayılan: anlatıcıya daha çok malzeme veren "sinematik" ayar. */
export const DEFAULT_RULES: RuleOptions = {
  ...RAW_RULES,
  partialSuccessMargin: 3,
  degreesOfSuccess: true,
  naturalStepsOnChecks: true,
};
