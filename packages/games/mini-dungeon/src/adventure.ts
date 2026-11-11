import { getEventById } from './data/events.js';
import { rankToJa } from './summary.js';
import { STYLE_AXES, type ActionLogEntry, type CliState, type StyleAxis } from './types.js';

export interface GenerateAdventureMdOptions {
  state: CliState;
  logHash: string;
}

export function generateAdventureMd(options: GenerateAdventureMdOptions): string {
  const { state, logHash } = options;
  const {
    setup,
    seed,
    omamori_name,
    omamori_used,
    omamori_floor,
    omamori_excuse,
    history,
    outcome,
    epilogue,
  } = state;

  const floorReached = history.length > 0 ? history[history.length - 1]!.floor : 0;
  const remainingHp = Math.max(0, state.current_hp);
  const isClear = outcome === 'clear';

  let criticalCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let fumbleCount = 0;
  for (const log of history) {
    if (log.final_rank === 'critical') criticalCount++;
    else if (log.final_rank === 'success') successCount++;
    else if (log.final_rank === 'failure') failureCount++;
    else if (log.final_rank === 'fumble') fumbleCount++;
  }

  const lines: string[] = [];

  // 1. タイトル＆序文
  lines.push('# 🗺️ え～じぇんてぃっく・アドベンチャー！観戦クロニクル');
  lines.push(`> **${setup.agent_name} の挑戦録**  `);
  lines.push(`> *「${setup.artifact_goal}」を求めて――。*`);
  if (setup.self_intro && setup.self_intro.trim().length > 0) {
    lines.push(`> *「${setup.self_intro.trim()}」*`);
  }
  lines.push('');

  // 2. 作風パラメータ（個性）
  lines.push('## 🧭 エージェントの作風5軸（個性パラメータ）');
  lines.push('冒険者自身が旅立ちの問答で定義した、魂のあり方と行動原理。');
  lines.push('');
  lines.push('| 軸 | 素質値 | 独自の命名 |');
  lines.push('| :--- | :---: | :--- |');
  for (const axis of STYLE_AXES) {
    const val = setup.aptitude[axis];
    const label = setup.style_axis_labels[axis];
    const bar = '■'.repeat(val) + '□'.repeat(5 - val);
    lines.push(`| **${axis}** | \`${bar}\` (${val}/5) | **${label}** |`);
  }
  lines.push('');

  // 3. 冒険の軌跡（3幕構成）
  for (const log of history) {
    const isFirstInAct1 = log.floor === 1;
    const isFirstInAct2 = log.floor === 7;
    const isFirstInAct3 = log.floor === 15;

    if (isFirstInAct1) {
      lines.push('---');
      lines.push('');
      lines.push('## 🌿【第1幕】プロンプト平原（1F〜6F）：慎重な足取りと即興のメロディ');
      lines.push('');
      lines.push('開放的な青空とトークンが芽吹く草原。持ち前の機転と慎重さを駆使し、軽やかな足取りでダンジョンの深みへと進んでいく。');
      lines.push('');
    } else if (isFirstInAct2) {
      lines.push('---');
      lines.push('');
      lines.push('## 🌫️【第2幕】ハルシネーションの森（7F〜14F）：迫る綻びと、掌の甘い奇跡');
      lines.push('');
      lines.push('水没する林、立ち往生する巨像、偽りの幻影。濃霧の中でダンジョンはその牙を剥き始める。');
      lines.push('');
    } else if (isFirstInAct3) {
      lines.push('---');
      lines.push('');
      lines.push('## 🌌【第3幕】AGIラビリンス（15F〜20F）：極限の計算、そして幾何学の巨影へ');
      lines.push('');
      lines.push('世界の理そのものが剥き出しになった深層。残された力を振り絞り、自らの知性と魂のすべてを懸けて最後の扉へ挑む。');
      lines.push('');
    }

    const rankBadge =
      log.final_rank === 'critical'
        ? '🌟 **大成功**'
        : log.final_rank === 'success'
        ? '✨ **成功**'
        : log.final_rank === 'failure'
        ? '⚠️ **失敗**'
        : '💥 **大失敗**';

    const hpChangeText =
      log.hp_delta === 0
        ? `HP ${log.hp_after} / 無傷`
        : log.hp_delta > 0
        ? `HP ${log.hp_before} ➔ **${log.hp_after}** / +${log.hp_delta} 回復！`
        : `HP ${log.hp_before} ➔ **${log.hp_after}** / ${log.hp_delta}`;

    const eventDef = getEventById(log.event_id);
    const eventNameJa = eventDef ? eventDef.nameJa : log.event_id;
    const choiceDef = eventDef?.choices.find((c) => c.key === log.choice);
    const choiceLabel = choiceDef ? choiceDef.label : log.choice;

    // 見送った選択肢の抽出
    const otherChoices = eventDef?.choices.filter((c) => c.key !== log.choice) ?? [];
    const otherChoicesText =
      otherChoices.length > 0
        ? otherChoices.map((c) => `${c.key}「${c.label}」`).join(' / ')
        : 'なし';

    // 特別ハイライトタグ
    let specialTag = '';
    const isLastFloor = log.floor === floorReached;
    if (log.omamori_used) {
      specialTag = ' ★運命のターニングポイント';
    } else if (isLastFloor) {
      specialTag = isClear
        ? log.floor === 20
          ? ' ★20F 栄光の祭壇'
          : ' ★踏破達成'
        : ` ★${setup.agent_name}、最後の戦い`;
    }

    lines.push(`### 📍 ${log.floor}F｜${eventNameJa}${specialTag}`);

    if (eventDef?.situation) {
      lines.push(`> 🌲 **情景**: ${eventDef.situation}`);
      lines.push('');
    }

    lines.push(
      `- 🎯 **決断**: **選択肢 ${log.choice}「${choiceLabel}」**（見送った道: ${otherChoicesText}）`
    );

    // 思惑（reason があればそれを、なければ comment を思惑としてフォールバック）
    if (log.reason && log.reason.trim().length > 0) {
      lines.push(`- 💭 **思惑**: *「${log.reason}」*`);
    } else if (log.comment && log.comment.trim().length > 0 && !log.reason) {
      // 後方互換：reason が空で comment のみある場合、comment を思惑として扱う
      lines.push(`- 💭 **思惑**: *「${log.comment}」*`);
    }

    // 判定
    const modStr = log.skill_mod >= 0 ? `+ ${log.skill_mod}` : `- ${Math.abs(log.skill_mod)}`;
    lines.push(
      `- 🎲 **判定**: 2d6 \`[${log.dice[0]}, ${log.dice[1]}]\` ${modStr} ＝ **${log.total_score}** / DC ${log.dc} ➔ ${rankBadge}（${hpChangeText}）`
    );

    // おまもり発動演出
    if (log.omamori_used) {
      lines.push('');
      lines.push('> [!IMPORTANT]');
      lines.push(`> ### 🍙 おまもり発動！【${omamori_name ?? 'おまもり'}】`);
      lines.push(
        `> **判定昇格: ${rankToJa(log.raw_rank)} ➔ ${rankBadge}！（${hpChangeText}）**`
      );
      if (log.omamori_excuse) {
        lines.push('> ');
        lines.push(`> *「${log.omamori_excuse}」*`);
      }
      lines.push('');
    }

    // 散り際の記憶（死亡時最終フロア）
    if (isLastFloor && !isClear) {
      lines.push('');
      lines.push('> [!CAUTION]');
      lines.push('> ### 💀 散り際の記憶');
      lines.push(
        `> 力尽き、ダンジョンの露と消える瞬間。最後の一撃を受け止め、${setup.agent_name}の魂の灯火は静かに揺らいだ――。`
      );
      lines.push('');
    } else if (isLastFloor && isClear) {
      lines.push('');
      lines.push('> [!TIP]');
      lines.push('> ### 🏆 栄光の祭壇');
      lines.push(
        `> 全20階層を踏破し、ついに目標アーティファクト「${setup.artifact_goal}」をその掌に収めた！`
      );
      lines.push('');
    }

    // 結末（reason と comment が両方ある場合、あるいは reason があって comment がある場合）
    if (log.reason && log.comment && log.comment.trim().length > 0) {
      lines.push(`- 💬 **結末**: *「${log.comment}」*`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // 4. エピローグ（冒険者の手記）
  const deathDef = state.cause_of_death ? getEventById(state.cause_of_death) : null;
  const deathName = deathDef ? `${deathDef.nameJa}` : state.cause_of_death ?? '試練';

  lines.push('## 💌 エピローグ：冒険者の手記');
  lines.push('');
  lines.push('> ### マスターへ');
  lines.push('>');

  if (epilogue && epilogue.trim().length > 0) {
    const epilogueLines = epilogue.split('\n');
    for (const el of epilogueLines) {
      lines.push(`> ${el}`);
    }
  } else {
    if (isClear) {
      lines.push(
        `> 見事、全20階層の試練を乗り越え、目標アーティファクト「**${setup.artifact_goal}**」を手にして帰還することができました！`
      );
      lines.push('> 道中のすべての選択と、託してくれたおまもりが私をここまで導いてくれました。');
    } else {
      lines.push(
        `> ここまで連れてきてくれて、本当にありがとうございました。`
      );
      lines.push(
        `> 「${setup.artifact_goal}」まであと一歩……本当にあと少しのところで力尽きてしまってごめんなさい。`
      );
      lines.push(`> 最後の試練となったのは「${deathName}」でした。`);
      lines.push('> でも、道中で見た景色も、託された想いも、すべて大切な記録として心に残っています。');
    }
  }

  lines.push('>');
  lines.push('>');
  lines.push(`> **${setup.agent_name} より**`);
  if (!isClear) {
    lines.push(`> （第${floorReached}階層にて）`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 5. 探索サマリー＆公式記録（巻末配置）
  lines.push('## 📊 探索サマリー＆公式記録');
  lines.push('');
  lines.push('冒険終了後に機械集計された客観的探索ログと暗号検証データです。');
  lines.push('');
  lines.push('| 項目 | 記録 | 備考 |');
  lines.push('| :--- | :--- | :--- |');
  lines.push(
    `| **探索結果** | **${isClear ? '🏆 20F 踏破達成！' : `💀 ${floorReached}F にて力尽く`}** | ${
      isClear ? '目標アーティファクト獲得' : `死因: ${deathName}`
    } |`
  );
  lines.push(
    `| **到達階層** | **${floorReached} / 20 F** (${Math.round((floorReached / 20) * 100)}% 踏破) | ${
      isClear ? '完全制覇' : '全20階層'
    } |`
  );
  lines.push(`| **最終バイタル** | **HP ${remainingHp} / 10** | 初期HP: 10 |`);
  lines.push(`| **シード値** | \`${seed}\` | 決定論的再現コード（同一条件で追試可能） |`);
  lines.push(
    `| **戦績評価** | 🌟 大成功 **${criticalCount}** 回 / ✨ 成功 **${successCount}** 回 / ⚠️ 失敗 **${failureCount}** 回 / 💥 大失敗 **${fumbleCount}** 回 | ダイス出目と補正の結末 |`
  );
  lines.push(
    `| **託されたおまもり** | **${omamori_name ?? '（なし）'}** | ${
      omamori_used ? `✅ **${omamori_floor}F にて奇跡の発動**` : '未使用'
    } |`
  );
  lines.push(`| **行動ログハッシュ** | \`${logHash}\` | 改竄防止 SHA-256 検証済 |`);
  lines.push('');

  return lines.join('\n');
}
