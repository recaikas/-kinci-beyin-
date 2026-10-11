-- OTOMATİK ÜRETİLDİ: npm run gen:seed (scripts/gen-seed.ts). Elle düzenleme.
-- This work includes material taken from the System Reference Document 5.1 ("SRD 5.1")
-- by Wizards of the Coast LLC, licensed under CC-BY-4.0.

-- SRD kataloğu
insert into public.catalog (kind, key, data) values
  ('weapon', 'dagger', '{"key":"dagger","name":"Hançer","damage":"1d4","damageType":"piercing","finesse":true,"range":[20,60]}'::jsonb),
  ('weapon', 'shortsword', '{"key":"shortsword","name":"Kısa Kılıç","damage":"1d6","damageType":"piercing","finesse":true}'::jsonb),
  ('weapon', 'longsword', '{"key":"longsword","name":"Uzun Kılıç","damage":"1d8","damageType":"slashing","versatile":"1d10"}'::jsonb),
  ('weapon', 'greatsword', '{"key":"greatsword","name":"Büyük Kılıç","damage":"2d6","damageType":"slashing","twoHanded":true}'::jsonb),
  ('weapon', 'greataxe', '{"key":"greataxe","name":"Büyük Balta","damage":"1d12","damageType":"slashing","twoHanded":true}'::jsonb),
  ('weapon', 'mace', '{"key":"mace","name":"Gürz","damage":"1d6","damageType":"bludgeoning"}'::jsonb),
  ('weapon', 'quarterstaff', '{"key":"quarterstaff","name":"Asa","damage":"1d6","damageType":"bludgeoning","versatile":"1d8"}'::jsonb),
  ('weapon', 'rapier', '{"key":"rapier","name":"Meç","damage":"1d8","damageType":"piercing","finesse":true}'::jsonb),
  ('weapon', 'scimitar', '{"key":"scimitar","name":"Pala","damage":"1d6","damageType":"slashing","finesse":true}'::jsonb),
  ('weapon', 'spear', '{"key":"spear","name":"Mızrak","damage":"1d6","damageType":"piercing","versatile":"1d8","range":[20,60]}'::jsonb),
  ('weapon', 'shortbow', '{"key":"shortbow","name":"Kısa Yay","damage":"1d6","damageType":"piercing","ranged":true,"range":[80,320],"twoHanded":true}'::jsonb),
  ('weapon', 'longbow', '{"key":"longbow","name":"Uzun Yay","damage":"1d8","damageType":"piercing","ranged":true,"range":[150,600],"twoHanded":true}'::jsonb),
  ('weapon', 'light_crossbow', '{"key":"light_crossbow","name":"Hafif Arbalet","damage":"1d8","damageType":"piercing","ranged":true,"range":[80,320],"twoHanded":true}'::jsonb),
  ('weapon', 'unarmed', '{"key":"unarmed","name":"Silahsız Vuruş","damage":"1","damageType":"bludgeoning"}'::jsonb),
  ('weapon', 'bite', '{"key":"bite","name":"Isırık","damage":"2d4","damageType":"piercing","finesse":true}'::jsonb),
  ('weapon', 'greatclub', '{"key":"greatclub","name":"Dev Sopa","damage":"2d8","damageType":"bludgeoning"}'::jsonb),
  ('spell', 'fire_bolt', '{"key":"fire_bolt","name":"Ateş Oku","level":0,"school":"evocation","castingTime":"action","rangeFt":120,"concentration":false,"attack":"ranged","damage":"1d10","damageType":"fire","summary":"Menzilli büyü saldırısı; isabette 1d10 ateş hasarı, yanıcı nesneleri tutuşturur."}'::jsonb),
  ('spell', 'sacred_flame', '{"key":"sacred_flame","name":"Kutsal Alev","level":0,"school":"evocation","castingTime":"action","rangeFt":60,"concentration":false,"save":"dex","damage":"1d8","damageType":"radiant","halfOnSave":false,"summary":"Hedef DEX kurtarması yapar; başarısızsa 1d8 ışıltı hasarı. Siper fayda etmez."}'::jsonb),
  ('spell', 'magic_missile', '{"key":"magic_missile","name":"Büyülü Füze","level":1,"school":"evocation","castingTime":"action","rangeFt":120,"concentration":false,"damageType":"force","autoHitDarts":{"count":3,"damage":"1d4+1"},"summary":"Üç parlayan ok otomatik isabet eder; her biri 1d4+1 güç hasarı. Üst yuvada +1 ok."}'::jsonb),
  ('spell', 'burning_hands', '{"key":"burning_hands","name":"Yakan Eller","level":1,"school":"evocation","castingTime":"action","rangeFt":15,"concentration":false,"save":"dex","damage":"3d6","damageType":"fire","halfOnSave":true,"upcastDice":"1d6","maxTargets":6,"summary":"4,5 m''lik koni; DEX kurtarması, 3d6 ateş (başarıda yarı)."}'::jsonb),
  ('spell', 'cure_wounds', '{"key":"cure_wounds","name":"Yara İyileştir","level":1,"school":"evocation","castingTime":"action","rangeFt":5,"concentration":false,"heal":"1d8","addAbilityMod":true,"upcastDice":"1d8","summary":"Dokunulan yaratık 1d8 + büyü yeteneği modu kadar iyileşir."}'::jsonb),
  ('spell', 'healing_word', '{"key":"healing_word","name":"Şifa Sözü","level":1,"school":"evocation","castingTime":"bonus_action","rangeFt":60,"concentration":false,"heal":"1d4","addAbilityMod":true,"upcastDice":"1d4","summary":"Bonus eylemle uzaktan 1d4 + mod iyileştirme."}'::jsonb),
  ('spell', 'hold_person', '{"key":"hold_person","name":"Kişiyi Tut","level":2,"school":"enchantment","castingTime":"action","rangeFt":60,"concentration":true,"save":"wis","conditionsOnFail":["paralyzed"],"upcastTargets":1,"summary":"İnsansı hedef WIS kurtarmasında başarısızsa felç olur (konsantrasyon)."}'::jsonb),
  ('spell', 'fireball', '{"key":"fireball","name":"Ateş Topu","level":3,"school":"evocation","castingTime":"action","rangeFt":150,"concentration":false,"save":"dex","damage":"8d6","damageType":"fire","halfOnSave":true,"upcastDice":"1d6","maxTargets":20,"summary":"6 m yarıçaplı patlama; DEX kurtarması, 8d6 ateş (başarıda yarı)."}'::jsonb),
  ('spell', 'false_life', '{"key":"false_life","name":"Sahte Yaşam","level":1,"school":"necromancy","castingTime":"action","rangeFt":0,"concentration":false,"tempHp":"1d4+4","summary":"Kendine 1d4+4 geçici HP."}'::jsonb),
  ('item', 'potion_of_healing', '{"key":"potion_of_healing","name":"İyileştirme İksiri","type":"potion","valueCp":5000,"weightLb":0.5,"heal":"2d4+2","consumable":true,"description":"Kırmızı, ışıldayan sıvı. 2d4+2 HP iyileştirir."}'::jsonb),
  ('item', 'healers_kit', '{"key":"healers_kit","name":"Şifacı Seti","type":"tool","valueCp":500,"weightLb":3,"consumable":true,"description":"10 kullanımlık; 0 HP''deki yaratığı kontrol gerektirmeden stabilize eder."}'::jsonb),
  ('item', 'thieves_tools', '{"key":"thieves_tools","name":"Hırsız Aletleri","type":"tool","valueCp":2500,"weightLb":1,"description":"Kilit açma ve tuzak etkisizleştirme."}'::jsonb),
  ('item', 'rope_hempen', '{"key":"rope_hempen","name":"Kenevir Halat (15 m)","type":"gear","valueCp":100,"weightLb":10,"description":"DC 17 Güç kontrolüyle koparılabilir."}'::jsonb),
  ('item', 'torch', '{"key":"torch","name":"Meşale","type":"gear","valueCp":1,"weightLb":1,"consumable":true,"description":"1 saat yanar; 6 m parlak, 6 m loş ışık."}'::jsonb),
  ('item', 'rations', '{"key":"rations","name":"Erzak (1 gün)","type":"gear","valueCp":50,"weightLb":2,"consumable":true,"description":"Kurutulmuş et, peksimet, kuruyemiş."}'::jsonb),
  ('monster', 'goblin', '{"saveProficiencies":[],"skillProficiencies":["stealth"],"expertise":["stealth"],"tempHp":0,"conditions":[],"exhaustion":0,"resistances":[],"immunities":[],"vulnerabilities":[],"conditionImmunities":[],"deathSaves":{"successes":0,"failures":0,"stable":false},"inspiration":false,"features":{},"xp":0,"isAlive":true,"size":"small","name":"Goblin","kind":"monster","level":1,"cr":0.25,"abilities":{"str":8,"dex":14,"con":10,"int":10,"wis":8,"cha":8},"hp":7,"maxHp":7,"ac":15,"speed":30,"hitDice":{"6":2},"hitDiceMax":{"6":2},"attacks":["scimitar","shortbow"]}'::jsonb),
  ('monster', 'guard', '{"saveProficiencies":[],"skillProficiencies":["perception"],"expertise":[],"tempHp":0,"conditions":[],"exhaustion":0,"resistances":[],"immunities":[],"vulnerabilities":[],"conditionImmunities":[],"deathSaves":{"successes":0,"failures":0,"stable":false},"inspiration":false,"features":{},"xp":0,"isAlive":true,"size":"medium","name":"Muhafız","kind":"npc","level":1,"cr":0.125,"abilities":{"str":13,"dex":12,"con":12,"int":10,"wis":11,"cha":10},"hp":11,"maxHp":11,"ac":16,"speed":30,"hitDice":{"8":2},"hitDiceMax":{"8":2},"attacks":["spear"]}'::jsonb),
  ('monster', 'bandit', '{"saveProficiencies":[],"skillProficiencies":[],"expertise":[],"tempHp":0,"conditions":[],"exhaustion":0,"resistances":[],"immunities":[],"vulnerabilities":[],"conditionImmunities":[],"deathSaves":{"successes":0,"failures":0,"stable":false},"inspiration":false,"features":{},"xp":0,"isAlive":true,"size":"medium","name":"Haydut","kind":"npc","level":1,"cr":0.125,"abilities":{"str":11,"dex":12,"con":12,"int":10,"wis":10,"cha":10},"hp":11,"maxHp":11,"ac":12,"speed":30,"hitDice":{"8":2},"hitDiceMax":{"8":2},"attacks":["scimitar","light_crossbow"]}'::jsonb),
  ('monster', 'skeleton', '{"saveProficiencies":[],"skillProficiencies":[],"expertise":[],"tempHp":0,"conditions":[],"exhaustion":0,"resistances":[],"immunities":["poison"],"vulnerabilities":["bludgeoning"],"conditionImmunities":["poisoned"],"deathSaves":{"successes":0,"failures":0,"stable":false},"inspiration":false,"features":{},"xp":0,"isAlive":true,"size":"medium","name":"İskelet","kind":"monster","level":1,"cr":0.25,"abilities":{"str":10,"dex":14,"con":15,"int":6,"wis":8,"cha":5},"hp":13,"maxHp":13,"ac":13,"speed":30,"hitDice":{"8":2},"hitDiceMax":{"8":2},"attacks":["shortsword","shortbow"]}'::jsonb),
  ('monster', 'wolf', '{"saveProficiencies":[],"skillProficiencies":["perception","stealth"],"expertise":[],"tempHp":0,"conditions":[],"exhaustion":0,"resistances":[],"immunities":[],"vulnerabilities":[],"conditionImmunities":[],"deathSaves":{"successes":0,"failures":0,"stable":false},"inspiration":false,"features":{},"xp":0,"isAlive":true,"size":"medium","name":"Kurt","kind":"monster","level":1,"cr":0.25,"abilities":{"str":12,"dex":15,"con":12,"int":3,"wis":12,"cha":6},"hp":11,"maxHp":11,"ac":13,"speed":40,"hitDice":{"8":2},"hitDiceMax":{"8":2},"attacks":["bite"]}'::jsonb),
  ('monster', 'ogre', '{"saveProficiencies":[],"skillProficiencies":[],"expertise":[],"tempHp":0,"conditions":[],"exhaustion":0,"resistances":[],"immunities":[],"vulnerabilities":[],"conditionImmunities":[],"deathSaves":{"successes":0,"failures":0,"stable":false},"inspiration":false,"features":{},"xp":0,"isAlive":true,"size":"large","name":"Ogre","kind":"monster","level":5,"cr":2,"abilities":{"str":19,"dex":8,"con":16,"int":5,"wis":7,"cha":7},"hp":59,"maxHp":59,"ac":11,"speed":40,"hitDice":{"10":7},"hitDiceMax":{"10":7},"attacks":["greatclub"]}'::jsonb)
on conflict (kind, key) do update set data = excluded.data;

-- Demo dünyası (sistem dünyası, herkese açık)
insert into public.worlds (id, owner_id, title, premise, tone, rules, is_public) values
  ('5eed0000-0000-4000-8000-000000000001', null, 'Karaçam Sınırı', 'Çökmekte olan Varna Krallığı''nın kuzey sınırında, çam ormanlarıyla çevrili Karaçam kasabası. Krallık ordusu çekildi; kasabayı gönülsüz bir muhafız birliği, açgözlü bir tüccar loncası ve ormandan inen goblin akınları arasında kalan halk ayakta tutuyor. Oyuncu, kasabaya bir mektup teslim etmek için gelen ama kapıda durdurulan bir gezgindir.', 'Karanlık ama umutlu; kirli çamur, soğuk sis, küçük insanların büyük cesaretleri.', array['Büyü nadirdir ve halk büyücülerden çekinir.', 'Krallık parası: 1 altın = 10 gümüş = 100 bakır.', 'Goblinler insan dilini kırık dökük konuşur ve ateşten korkar.', 'Ölüler geri gelmez; diriltme büyüsü bu dünyada bilinmez.']::text[], true)
on conflict (id) do nothing;

insert into public.places (id, world_id, name, description) values
  ('5eed0000-0000-4000-8000-000000000100', '5eed0000-0000-4000-8000-000000000001', 'Karaçam Kuzey Kapısı', 'Meşalelerle aydınlatılmış ahşap kapı; çamurlu yolda tek bir nöbetçi kulübesi.'),
  ('5eed0000-0000-4000-8000-000000000101', '5eed0000-0000-4000-8000-000000000001', 'Karaçam Pazarı', 'Islak tahta tezgâhlar, tütsülenmiş balık kokusu, tüccar loncasının mühürlü sandıkları.'),
  ('5eed0000-0000-4000-8000-000000000102', '5eed0000-0000-4000-8000-000000000001', 'Kuzey Çam Ormanı', 'Sisli, sık çamlar; yerde taze goblin ayak izleri.')
on conflict (id) do nothing;

insert into public.place_exits (from_id, to_id, travel_minutes) values
  ('5eed0000-0000-4000-8000-000000000100', '5eed0000-0000-4000-8000-000000000101', 10),
  ('5eed0000-0000-4000-8000-000000000100', '5eed0000-0000-4000-8000-000000000102', 30),
  ('5eed0000-0000-4000-8000-000000000101', '5eed0000-0000-4000-8000-000000000100', 10),
  ('5eed0000-0000-4000-8000-000000000102', '5eed0000-0000-4000-8000-000000000100', 30)
on conflict do nothing;

-- Oturumdaki kullanıcı için demo kampanyası başlatır; kampanya id döner.
create or replace function public.start_demo_campaign(p_title text default 'Karaçam Günlükleri')
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_campaign uuid := gen_random_uuid();
  ids record;
begin
  if v_user is null then
    raise exception 'oturum gerekli' using errcode = '28000';
  end if;
  select gen_random_uuid() as arda, gen_random_uuid() as kerem, gen_random_uuid() as selin, gen_random_uuid() as gob1, gen_random_uuid() as gob2 into ids;

  insert into public.campaigns (id, owner_id, world_id, title, game_time, scene_location_id)
  values (v_campaign, v_user, '5eed0000-0000-4000-8000-000000000001', p_title, 1110, '5eed0000-0000-4000-8000-000000000100');

  insert into public.creatures (id, campaign_id, kind, name, level, cr, size, abilities, save_proficiencies,
    skill_proficiencies, expertise, hp, max_hp, ac, speed, resistances, immunities, vulnerabilities,
    condition_immunities, hit_dice, hit_dice_max, features, xp, attacks, location_id)
  values (ids.arda, v_campaign, 'pc', 'Arda', 3, null, 'medium', '{"str":10,"dex":16,"con":14,"int":12,"wis":12,"cha":14}'::jsonb,
    array['dex', 'int']::text[], array['stealth', 'persuasion', 'deception', 'perception', 'sleight_of_hand']::text[], array['stealth', 'persuasion']::text[], 21, 21, 14, 30,
    array[]::text[], array[]::text[], array[]::text[], array[]::text[],
    '{"8":3}'::jsonb, '{"8":3}'::jsonb, '{}'::jsonb, 900, array[]::text[], '5eed0000-0000-4000-8000-000000000100');
  insert into public.creatures (id, campaign_id, kind, name, level, cr, size, abilities, save_proficiencies,
    skill_proficiencies, expertise, hp, max_hp, ac, speed, resistances, immunities, vulnerabilities,
    condition_immunities, hit_dice, hit_dice_max, features, xp, attacks, location_id)
  values (ids.kerem, v_campaign, 'npc', 'Muhafız Kerem', 1, 0.125, 'medium', '{"str":13,"dex":12,"con":12,"int":10,"wis":11,"cha":10}'::jsonb,
    array[]::text[], array['perception']::text[], array[]::text[], 11, 11, 16, 30,
    array[]::text[], array[]::text[], array[]::text[], array[]::text[],
    '{"8":2}'::jsonb, '{"8":2}'::jsonb, '{}'::jsonb, 0, array['spear']::text[], '5eed0000-0000-4000-8000-000000000100');
  insert into public.creatures (id, campaign_id, kind, name, level, cr, size, abilities, save_proficiencies,
    skill_proficiencies, expertise, hp, max_hp, ac, speed, resistances, immunities, vulnerabilities,
    condition_immunities, hit_dice, hit_dice_max, features, xp, attacks, location_id)
  values (ids.selin, v_campaign, 'npc', 'Tüccar Selin', 1, 0.125, 'medium', '{"str":11,"dex":12,"con":12,"int":10,"wis":10,"cha":10}'::jsonb,
    array[]::text[], array[]::text[], array[]::text[], 11, 11, 12, 30,
    array[]::text[], array[]::text[], array[]::text[], array[]::text[],
    '{"8":2}'::jsonb, '{"8":2}'::jsonb, '{}'::jsonb, 0, array['scimitar', 'light_crossbow']::text[], '5eed0000-0000-4000-8000-000000000101');
  insert into public.creatures (id, campaign_id, kind, name, level, cr, size, abilities, save_proficiencies,
    skill_proficiencies, expertise, hp, max_hp, ac, speed, resistances, immunities, vulnerabilities,
    condition_immunities, hit_dice, hit_dice_max, features, xp, attacks, location_id)
  values (ids.gob1, v_campaign, 'monster', 'Goblin Izgir', 1, 0.25, 'small', '{"str":8,"dex":14,"con":10,"int":10,"wis":8,"cha":8}'::jsonb,
    array[]::text[], array['stealth']::text[], array['stealth']::text[], 7, 7, 15, 30,
    array[]::text[], array[]::text[], array[]::text[], array[]::text[],
    '{"6":2}'::jsonb, '{"6":2}'::jsonb, '{}'::jsonb, 0, array['scimitar', 'shortbow']::text[], '5eed0000-0000-4000-8000-000000000102');
  insert into public.creatures (id, campaign_id, kind, name, level, cr, size, abilities, save_proficiencies,
    skill_proficiencies, expertise, hp, max_hp, ac, speed, resistances, immunities, vulnerabilities,
    condition_immunities, hit_dice, hit_dice_max, features, xp, attacks, location_id)
  values (ids.gob2, v_campaign, 'monster', 'Goblin Pıtpıt', 1, 0.25, 'small', '{"str":8,"dex":14,"con":10,"int":10,"wis":8,"cha":8}'::jsonb,
    array[]::text[], array['stealth']::text[], array['stealth']::text[], 7, 7, 15, 30,
    array[]::text[], array[]::text[], array[]::text[], array[]::text[],
    '{"6":2}'::jsonb, '{"6":2}'::jsonb, '{}'::jsonb, 0, array['scimitar', 'shortbow']::text[], '5eed0000-0000-4000-8000-000000000102');
  update public.campaigns set player_character_id = ids.arda where id = v_campaign;
  insert into public.personas (creature_id, personality, goals, speech_style) values (ids.kerem, 'Yorgun, açgözlü ama korkak; maaşı üç aydır ödenmedi.', 'Nöbeti olaysız bitirip meyhaneye gitmek.', 'Kısa, homurtulu cümleler; ''yabancı'' diye hitap eder.');
  insert into public.personas (creature_id, personality, goals, speech_style) values (ids.selin, 'Kurnaz, hesapçı, gizlice kasabayı seviyor.', 'Goblin akınlarının ticareti öldürmesini engellemek.', 'Tatlı dilli, pazarlıkta acımasız.');
  insert into public.personas (creature_id, personality, goals, speech_style) values (ids.gob1, 'Sinsi ve korkak; çetenin keşifçisi.', 'Yiyecek çalmak.', 'Kırık Türkçe, kendinden üçüncü şahısla bahseder.');
  insert into public.personas (creature_id, personality, goals, speech_style) values (ids.gob2, 'Saldırgan, çabuk öfkelenir.', 'Izgir''i korumak, parlak şeyler toplamak.', 'Bağırarak, tek kelimelik cümleler.');
  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.arda, 'rapier', 1);
  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.arda, 'shortbow', 1);
  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.arda, 'potion_of_healing', 2);
  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.arda, 'thieves_tools', 1);
  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.arda, 'torch', 3);
  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.selin, 'potion_of_healing', 5);
  insert into public.inventory (campaign_id, owner_id, item_key, qty) values (v_campaign, ids.selin, 'rations', 20);
  insert into public.wallets (campaign_id, owner_id, cp) values (v_campaign, ids.arda, 4500);
  insert into public.wallets (campaign_id, owner_id, cp) values (v_campaign, ids.selin, 20000);
  insert into public.relationships (campaign_id, a, b, score) values (v_campaign, least(ids.arda, ids.kerem), greatest(ids.arda, ids.kerem), -10);
  insert into public.relationships (campaign_id, a, b, score) values (v_campaign, least(ids.arda, ids.selin), greatest(ids.arda, ids.selin), 0);
  insert into public.facts (campaign_id, subject, predicate, value, locked, source)
  values (v_campaign, ids.kerem::text, 'kızının adı', 'Elif', true, 'author');
  insert into public.quests (campaign_id, title, objectives, created_turn)
  values (v_campaign, 'Mektubu Karaçam muhtarına teslim et', '[{"text":"Kasabaya gir"},{"text":"Muhtarı bul"}]'::jsonb, 0);
  return v_campaign;
end;
$$;
revoke all on function public.start_demo_campaign(text) from public, anon;
grant execute on function public.start_demo_campaign(text) to authenticated;
