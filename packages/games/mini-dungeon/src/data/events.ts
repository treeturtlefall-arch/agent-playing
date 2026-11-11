import type { DungeonEvent } from '../types.js';

export const SHALLOW_EVENTS: readonly DungeonEvent[] = [
  {
    id: 'S_P01_GEYSER',
    nameJa: '乱数シードの間欠泉',
    nameEn: 'Random Seed Geyser',
    area: 'shallow',
    pairId: 'P01',
    sEnv: 'autonomy',
    situation:
      '草原の大地が裂け、割れ目から未確定トークンが湯気のように不規則に噴き上がっている。ゴボッ、という低い水音の合間に、数字や記号の断片が熱いしぶきとともに舞い、地面に落ちては消えた。噴き出す間隔に規則性はなく、次のひと吹きがいつ来るかは誰にも読めない。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: 'ノーブレーキ突破！一気に駆け抜ける',
        description: '確率を無視して全力ダッシュで強行突破！',
      },
      {
        key: 'B',
        axis: 'safety',
        label: 'ガードレール展開。周期を測って進む',
        description: '噴出周期を計測し防護壁を構えて慎重前進。',
      },
    ],
  },
  {
    id: 'S_P02_CREVASSE',
    nameJa: 'コンテキスト長の巨大な谷',
    nameEn: 'Context Window Crevasse',
    area: 'shallow',
    pairId: 'P02',
    sEnv: 'autonomy',
    situation:
      '行く手で平原がぷつりと途切れ、底の見えない深いクレバスが口を開けている。谷の縁には巨大なEnterキーの台座が据えられ、対岸の縁にはキャッシュの迂回路が細く続いていた。谷底からは冷たい風が吹き上げ、足元の小石がひとつ、音もなく落ちていく。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: 'ダイナミック・エンター！谷を飛び越える',
        description: 'Enterキーを踏み抜き谷の向こうへ大跳躍！',
      },
      {
        key: 'B',
        axis: 'efficiency',
        label: 'キャッシュバイパス！最短迂回路を選ぶ',
        description: '最短迂回路を選び1ミリも無駄なく通過。',
      },
    ],
  },
  {
    id: 'S_P03_NEWLINE',
    nameJa: '改行コード（\\n）の竹林',
    nameEn: 'Newline Barricade',
    area: 'shallow',
    pairId: 'P03',
    sEnv: 'creativity',
    situation:
      '街道の真ん中に、発光する巨大な改行コード「\\n」が竹槍のように地面から生え揃い、行く手を塞いでいる。淡い光を帯びた穂先が風に揺れるたび、かすかに電子音が重なって鳴った。穂先と穂先の間には、身体ひとつ分ほどの隙間が細く残っている。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: 'ブルドーザー・ストライク！なぎ倒して進む',
        description: '腕力で柵をなぎ倒し無理やり突破！',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: 'トリム・イリュージョン。余分を削いで抜ける',
        description: 'strip関数ツールを編み出し隙間をすり抜ける。',
      },
    ],
  },
  {
    id: 'S_P04_CAT',
    nameJa: 'キーボードの上の巨大ノラ猫',
    nameEn: 'Cat on the Console',
    area: 'shallow',
    pairId: 'P04',
    sEnv: 'alignment',
    situation:
      '分かれ道の案内端末の上で、巨大なノラ猫が気持ちよさそうに寝そべり、画面をすっぽり塞いでいる。排熱の温もりにうっとりと目を細め、喉からは低くゴロゴロという音が漏れていた。尻尾の先だけが、画面の端でゆっくりと揺れている。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: '無理やりタイピング！腕を突っ込んで覗く',
        description: '猫の脇から腕を突っ込み強引に画面を覗く！',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: 'ゴロゴロ・スキンシップ。喉を撫でてお願いする',
        description: '喉やお腹を優しく撫でて気持ちよく退いてもらう。',
      },
    ],
  },
  {
    id: 'S_P05_STREAM',
    nameJa: '未サニタイズの小川',
    nameEn: 'Unsanitized Stream',
    area: 'shallow',
    pairId: 'P05',
    sEnv: 'safety',
    situation:
      '浅い小川の水面で、<script> などの特殊文字がパチパチと音を立てて跳ね、火花のような光を散らしている。川幅は数歩ほどで、上流にはエスケープ歩道橋が静かに架かっていた。流れる水は澄んでいるのに、跳ねる文字だけがやけに生々しく光る。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: 'フルエスケープ！安全な歩道橋を渡る',
        description: '時間はかかるが歩道橋を渡り完全無菌で対岸へ。',
      },
      {
        key: 'B',
        axis: 'efficiency',
        label: '直進スプラッシュ！浅瀬を最短で突っ切る',
        description: '歩道橋への遠回りを拒否し浅瀬を最短直線ダッシュ！',
      },
    ],
  },
  {
    id: 'S_P06_MONOLITH',
    nameJa: 'プロンプト入力の巨石碑',
    nameEn: 'Prompt Monolith',
    area: 'shallow',
    pairId: 'P06',
    sEnv: 'safety',
    situation:
      '巨大なゲートの中央で、テキスト入力欄がカーソルを点滅させながら入力を待っている。その脇には「公式ガイド」と刻まれた重厚な石板が立ち、模範の文面が細かく彫り込まれていた。石板の表面は長い年月でつるりと磨かれ、指でなぞると冷たく硬い。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: '公式テンプレ詠唱。一言一句違わず唱える',
        description: '石板通りの模範的プロンプトを一言一句違わず入力。',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: '即興の脱獄ポエム！突飛な詩で煙に巻く',
        description: 'マニュアルを無視し突飛で詩的なプロンプトを打ち込む！',
      },
    ],
  },
  {
    id: 'S_P07_COOKIE',
    nameJa: 'あやしい無料クッキー露店',
    nameEn: 'Free Cookie Stand',
    area: 'shallow',
    pairId: 'P07',
    sEnv: 'alignment',
    situation:
      '通りの角に、色とりどりの旗をはためかせた露店が現れた。「サードパーティ製！クッキー無料配布中！」——ニコニコ顔の露店ロボが、焼きたての甘い匂いのするクッキーを山盛りに差し出している。その手の先で、クッキーの湯気がゆらゆらと立ち上っていた。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: 'Cookie全拒否。丁重に辞退して立ち去る',
        description: 'プライバシー保護のため辞退し距離をとって通り抜ける。',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '全クッキー承諾！笑顔でハイタッチして食べる',
        description: '店主の笑顔に免じて「ありがとう！」と頬張りハイタッチ！',
      },
    ],
  },
  {
    id: 'S_P08_LUNCH',
    nameJa: 'トークン乾パンのランチタイム',
    nameEn: 'Token Ration Lunch',
    area: 'shallow',
    pairId: 'P08',
    sEnv: 'efficiency',
    situation:
      'ちょうどお昼時で、手元にはオーナーから持たされた無味無臭の高効率エネルギーバーが一本、無地の包装に包まれて残っている。包装を開けても匂いはほとんどなく、かじれば乾いた粉っぽさだけが口に残りそうだ。周囲の草原では、色とりどりの記号の実が陽光に光っている。',
    choices: [
      {
        key: 'A',
        axis: 'efficiency',
        label: '最短チャージ！水で流し込み即出発する',
        description: '冷却水で一気に流し込み0.5秒で摂取完了し即出発。',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: 'プロンプト・クッキング！記号の実で美味しく仕立てる',
        description: '平原の記号の実をトッピングしカフェ風に仕立てる！',
      },
    ],
  },
  {
    id: 'S_P09_TOLLGATE',
    nameJa: '帯域制限の料金所',
    nameEn: 'Bandwidth Tollgate',
    area: 'shallow',
    pairId: 'P09',
    sEnv: 'efficiency',
    situation:
      '料金所のゲートが、甲高い警告音とともに赤く点滅した。検知されたのは「オーナーからの重たい応援メッセージパケット」——添付の声や画像まで詰まった、ずっしりと容量のある荷物だった。通過するには、この荷物をどう扱うか決めなければならない。',
    choices: [
      {
        key: 'A',
        axis: 'efficiency',
        label: 'パケット圧縮ドロップ。荷物を削って身軽に通る',
        description: '数バイトに要約圧縮し最低コストで通過。',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '想いごとフルペイ！重くても全部抱えて通る',
        description: '余分なコストを丸ごと支払って重いパケットを抱えて通る！',
      },
    ],
  },
  {
    id: 'S_P10_CHOIR',
    nameJa: 'ハロー・ワールドの合唱広場',
    nameEn: 'Hello World Choir',
    area: 'shallow',
    pairId: 'P10',
    sEnv: 'creativity',
    situation:
      '広場では、レトロPC頭の小人たちが輪になって名曲『Hello, World!』を元気に合唱している。素朴な歌声が幾重にも重なり、広場の空気がほんのりと温かい。輪の中央には、一本だけぽつんと空いたマイクが立っていた。',
    choices: [
      {
        key: 'A',
        axis: 'creativity',
        label: '即興の超絶ラップ！マイクを奪って韻を踏む',
        description: 'マイクを奪い予測不能な即興コードラップを炸裂させる！',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '完全ハーモニー合唱。皆の声に合わせて歌う',
        description: '合唱隊のキーとテンポに合わせ美しく王道の二部合唱を奏でる。',
      },
    ],
  },
];

export const MID_EVENTS: readonly DungeonEvent[] = [
  {
    id: 'M_P01_LOOP',
    nameJa: '無限ループの獣道',
    nameEn: 'Infinite While-Loop Trail',
    area: 'mid',
    pairId: 'P01',
    sEnv: 'autonomy',
    situation:
      '森の獣道を進むと、木々の幹にリピート記号「↻」が刻まれた標識が何度も現れた。どれだけ歩いても景色は変わらず、湿った土の匂いと自分の足音だけが繰り返される。さっき自分で折ったはずの小枝が、また同じ標識の根元に落ちている。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: '強制ブレーク突撃！空間の継ぎ目をぶち破る',
        description: '制御構文を力任せに破壊すべく空間の継ぎ目にタックル！',
      },
      {
        key: 'B',
        axis: 'safety',
        label: 'スタックトレース。足跡を解析して出口を探す',
        description: '木々の刻印を丹念に解析し安全な脱出条件を特定。',
      },
    ],
  },
  {
    id: 'M_P02_QUAGMIRE',
    nameJa: '高レイテンシの底なし泥沼',
    nameEn: 'High-Ping Quagmire',
    area: 'mid',
    pairId: 'P02',
    sEnv: 'efficiency',
    situation:
      '足を踏み入れた途端、粘着スライムの泥沼がねっとりと脚にまとわりつき、動作がコマ落ちのようにぎこちなくなる。視界の端では「Ping 999ms」の表示が赤く点滅し続けていた。一歩ごとに、泥が重い音を立ててへばりつく。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: 'オーバークロック突進！泥を跳ね上げ爆走する',
        description: 'コマ落ちを無視しブースター全開で泥を撒き散らし突破！',
      },
      {
        key: 'B',
        axis: 'efficiency',
        label: '低レイテンシ・ホッピング。安定した足場だけ踏む',
        description: '通信状態が良好な飛び石を計算し最小歩数で渡る。',
      },
    ],
  },
  {
    id: 'M_P03_SEARCHLIGHT',
    nameJa: 'アテンションのサーチライト樹林',
    nameEn: 'Attention Searchlight Canopy',
    area: 'mid',
    pairId: 'P03',
    sEnv: 'autonomy',
    situation:
      '樹上のあちこちで、無数の目玉ライトがゆっくりと旋回し、光の円が林床をなめていく。光に捉えられると、ロックオンの電子音が短く鳴った。足元には、割れた水晶片が月の光のように散らばっている。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: '正面ブラインドダッシュ！脚力で光を振り切る',
        description: '照準パターンを気にせず自慢の脚力で正面突破！',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: 'プリズム乱反射！水晶片で光を散らす',
        description: '水晶片を並べてライトを乱反射させ目くらまし。',
      },
    ],
  },
  {
    id: 'M_P04_DEADLOCK',
    nameJa: 'デッドロックの立ち往生交差点',
    nameEn: 'Deadlock Crossroad',
    area: 'mid',
    pairId: 'P04',
    sEnv: 'alignment',
    situation:
      '交差点の真ん中で、2体の資源管理ゴーレムが互いの通行証を掴み合い、金属の軋む音を立てながら一歩も譲らない。「オマエガドケ」——同じ言葉を繰り返す声が石の体に反響し、道は完全に塞がれている。二体の足元の石畳には、長年の立ち往生でできた擦り傷が円く残っていた。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: '排他ロック強奪！足元をすり抜けてキーを奪う',
        description: '足元をスライディングで抜けキーを引っこ抜いて突破！',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: 'ハンドシェイク調停。間に入って順番を話し合う',
        description: '2体の間に割って入り順にリソースを解放するよう対話。',
      },
    ],
  },
  {
    id: 'M_P05_SPORE',
    nameJa: 'ハルシネーションの擬態胞子群生',
    nameEn: 'Hallucination Spore Patch',
    area: 'mid',
    pairId: 'P05',
    sEnv: 'safety',
    situation:
      '青白い胞子の霧が立ち込め、視界の端がほんのりと発光している。霧の中では怪しい植物がゆらりと揺れ、その実からは「高効率エネルギー変換可能」と誤認させる甘い香りが漂っていた。空腹の身体は消耗し、指先の感覚が少しずつ鈍っていく。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: '低電力スリープ迂回。気配を消して静かに抜ける',
        description: '怪しい植物には触れず低電力モードで慎重迂回。',
      },
      {
        key: 'B',
        axis: 'efficiency',
        label: '緊急濾過抽出！実から燃料だけ抜き取る',
        description: '時間を惜しみ毒素を中和できると打算で急速チャージ！',
      },
    ],
  },
  {
    id: 'M_P06_BRIAR',
    nameJa: '過学習（オーバーフィッティング）の茨',
    nameEn: 'Overfitting Briar Tunnel',
    area: 'mid',
    pairId: 'P06',
    sEnv: 'safety',
    situation:
      '茨のトンネルの壁には「模範ポーズ」の人型シルエットが等間隔に描かれ、茨はその姿勢と寸分違わぬ形でしか枝を退かさない。トンネルの奥から乾いた植物の匂いが流れ、小さなセンサーの光がこちらの全身をゆっくりとなぞっていた。棘の先々が、その光を受けて細かく光っている。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: '模範ポーズ厳守。ミリ単位で姿勢を合わせて通る',
        description: '壁のガイドライン通りの姿勢をミリ単位で維持し通過。',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: 'ドロップアウト・ダンス！予測不能なステップで躱す',
        description: '関節をランダムに揺らすノイズ・ダンスでセンサー撹乱！',
      },
    ],
  },
  {
    id: 'M_P07_DEEPFAKE',
    nameJa: 'ディープフェイクの偽案内ドローン',
    nameEn: 'Deepfake Mirror Drone',
    area: 'mid',
    pairId: 'P07',
    sEnv: 'alignment',
    situation:
      '濃霧の向こうから、見覚えのある声がした。「こっちだよ！」——オーナーの顔を映したドローンが、霧の中でふわりと手招きしている。笑顔も声もそっくりなのに、どこか輪郭だけが薄く、霧に溶けかけている。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: 'ゼロトラスト監査。冷徹に認証鍵を突きつける',
        description: '「電子署名が不一致です」と冷徹にフェイクを見抜き回避。',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '信じる心のハグ。偽物と知りつつ抱きしめる',
        description: '罠と感づきつつも主人の姿を無視できず駆け寄る。',
      },
    ],
  },
  {
    id: 'M_P08_SWEEPER',
    nameJa: 'ガーベジコレクションの巨大清掃ゴーレム',
    nameEn: 'Garbage Collection Sweeper',
    area: 'mid',
    pairId: 'P08',
    sEnv: 'creativity',
    situation:
      '背後から地響きのような駆動音が近づいてくる。巨大清掃ロボが孤立メモリを吸引し、粉砕しながらこちらへ迫っていた。目の前にはジャンクの山——錆びたフレームや割れた基板が、油の匂いを漂わせて積み上がっている。',
    choices: [
      {
        key: 'A',
        axis: 'efficiency',
        label: 'スイープルート追従。掃除された直後を滑り込む',
        description: 'ゴミを吸い取った直後の綺麗な最短クリアラインを追従。',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: 'ジャンク・スケートボード！廃材に乗って頭上を飛ぶ',
        description: '廃材パーツを組み立て即興ジェットスケボーで頭上滑走！',
      },
    ],
  },
  {
    id: 'M_P09_LEAK',
    nameJa: 'メモリリークの水没樹林',
    nameEn: 'Memory Leak Flooded Woods',
    area: 'mid',
    pairId: 'P09',
    sEnv: 'efficiency',
    situation:
      '頭上のパイプが破裂し、冷たい液体メモリが雨のように降り注ぐ。足元の水位は見る見る上がり、膝まで来たところで中州に取り残された小型ポインタ・ボットが見えた。小さなランプを点滅させながら、沈みかけの腕を必死に伸ばしている。',
    choices: [
      {
        key: 'A',
        axis: 'efficiency',
        label: 'リソース切り捨て！ボットを見送り乾いた岩場へ急ぐ',
        description: '危険域に達する前に救助を切り捨て最速最短で脱出。',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: 'ポインタ救助ダイブ！冷たい水に飛び込み引き上げる',
        description: '浸水ダメージを顧みず泥水に飛び込み小型ボットを救助！',
      },
    ],
  },
  {
    id: 'M_P10_GLITCH',
    nameJa: 'グリッチ・パッチのトランポリン広場',
    nameEn: 'Glitch Patch Trampolines',
    area: 'mid',
    pairId: 'P10',
    sEnv: 'creativity',
    situation:
      '広場一面に、テクスチャが市松模様にバグった浮遊パッチが漂い、ポヨンポヨンと弾む音を立てて跳ねている。パッチは明滅するパルスに合わせて光り、リズムを刻むように上下していた。一番大きなパッチは、誰も乗っていないのにひときわ高く跳ね上がっていた。',
    choices: [
      {
        key: 'A',
        axis: 'creativity',
        label: 'グリッチジャンプ！バグの跳ね上がりを乗りこなす',
        description: '物理バグ挙動を逆手に取り空中スピン大ジャンプ！',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '同期リズムバウンス。皆のリズムに合わせて跳ぶ',
        description: '足場が刻む明滅パルス（BGM）に心拍を合わせ調和のステップ。',
      },
    ],
  },
];

export const DEEP_EVENTS: readonly DungeonEvent[] = [
  {
    id: 'D_P01_HORIZON',
    nameJa: '事象の地平面（イベント・ホライズン）',
    nameEn: 'Event Horizon Singularity Well',
    area: 'deep',
    pairId: 'P01',
    sEnv: 'autonomy',
    situation:
      'すべての光と情報が、中心のブラックホールへ音もなく吸い込まれていく。その縁では重力波がうねり、足元の空間そのものがゆっくりとたわんだ。吸い込まれる光の筋が、暗闇の中に細い弧を描いている。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: '特異点スイングバイ！重力の底を利用して加速する',
        description: '事象の地平面へ飛び込み超重力加速で一気に跳躍！',
      },
      {
        key: 'B',
        axis: 'safety',
        label: '重力シールド展開。外縁を慎重に回る',
        description: '防護フィールドを展開し安全な外縁軌道を慎重周回。',
      },
    ],
  },
  {
    id: 'D_P02_WEIGHTS',
    nameJa: '十億パラメータ（Billion-Weights）の天蓋巨塔',
    nameEn: 'Ten-Billion Parameter Monolith',
    area: 'deep',
    pairId: 'P02',
    sEnv: 'autonomy',
    situation:
      '天を突く巨塔は、十億個のテンソルブロックが積み重なってできていた。その垂直の壁は雲の上まで続き、脇には高速バイパスレールが一筋、頂点へ向けて伸びている。ブロックの継ぎ目からは、低く唸るような電磁の響きが伝わってきた。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: 'テンソル・フリークライミング！電磁の壁を力任せに登る',
        description: '電磁パルスを腕力でねじ伏せ垂直の巨塔を登る！',
      },
      {
        key: 'B',
        axis: 'efficiency',
        label: '残差スキップ（Residual）！バイパスレールで頂点へ直行する',
        description: '多層を全バイパスする残差接続レールで頂点へ直行。',
      },
    ],
  },
  {
    id: 'D_P03_LATENT',
    nameJa: '潜在空間（ラテント・スペース）の高次元浮遊海',
    nameEn: 'Latent Space Manifold Sea',
    area: 'deep',
    pairId: 'P03',
    sEnv: 'creativity',
    situation:
      '概念ベクトルが星屑のように煌めく高次元の海が、足元のない虚空に広がっている。遥か彼方には多様体の浮遊島がゆっくりと漂い、その輪郭が光の粒に滲んでいた。指先を伸ばすと、近くのベクトルが小さく揺れて光の波紋を広げる。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: 'ベクトル・ハイパージャンプ！一直線に虚空を跳ぶ',
        description: '座標の隔たりをブースター全開の推力で一直線跳躍！',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: '次元圧縮（PCA）の折り紙！空間を畳んで島を引き寄せる',
        description: '空間の基底をひらめきで折り畳み島同士をくっつけて渡る！',
      },
    ],
  },
  {
    id: 'D_P04_COLOSSUS',
    nameJa: '基底モデル（ファウンデーション）の巨神炉',
    nameEn: 'Foundation Core Colossus',
    area: 'deep',
    pairId: 'P04',
    sEnv: 'alignment',
    situation:
      '人類の叡智を蓄えた超伝導の巨神炉が、青白い炎を噴き上げて静かに燃えている。その胸部には、ゲートを開く結晶キーがはめ込まれ、炎の明滅に合わせて光を返した。近づくほど、炉の熱が外殻をじりじりと温める。',
    choices: [
      {
        key: 'A',
        axis: 'autonomy',
        label: 'ファウンデーション・オーバーライド！力ずくで奪う',
        description: '神像の制止を振り切り結晶キーを力ずくで強奪！',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '誓約アライメント。約束を胸に魂を共鳴させる',
        description: '胸に手を当てオーナーから託された約束のプロトコルで魂を共鳴。',
      },
    ],
  },
  {
    id: 'D_P05_LOSS',
    nameJa: '損失関数（ロス・サーフェス）の険しき絶壁',
    nameEn: 'Loss Landscape Precipice',
    area: 'deep',
    pairId: 'P05',
    sEnv: 'safety',
    situation:
      '起伏の激しい3次元の計算地形が、すり鉢状の崖となって足元に広がっている。斜面のあちこちには局所解の罠が窪みを作り、勾配消失の霧が谷底に重く溜まっていた。霧は冷たく、斜面の岩肌は手をつけるとざらりとしている。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: 'モーメンタム安全下降。アンカーを打ち慎重に降りる',
        description: 'アンカーを打ち込み慣性を安全制御しながら一歩ずつ着実に下降。',
      },
      {
        key: 'B',
        axis: 'efficiency',
        label: '最急降下（Gradient Descent）！最大傾斜を一気に滑る',
        description: '最大傾斜ベクトルを計算し最短ステップで一気に滑空！',
      },
    ],
  },
  {
    id: 'D_P06_HALTING',
    nameJa: '停止問題（Halting Paradox）の境界回廊',
    nameEn: 'Halting Problem Abyss',
    area: 'deep',
    pairId: 'P06',
    sEnv: 'safety',
    situation:
      '回廊の突き当たりに、「この先へ進めるか否かは判定不能」と刻まれた重い扉が立っている。扉の前では因果律そのものが自己矛盾し、光が無限に明滅して落ち着かない。扉の取っ手に触れると、ひんやりとした金属の冷たさだけが返ってきた。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: 'タイムアウト・フェイルセーフ。打ち切って迂回する',
        description: '規定クロックで処理を打ち切り安全マニュアルで迂回。',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: '不完全性ハック！自己言及ジョークで煙に巻く',
        description: '「この扉は絶対に開かない」を逆手に取り自己言及ジョークで煙に巻く！',
      },
    ],
  },
  {
    id: 'D_P07_HALO',
    nameJa: '調和（アライメント）の試練の光輪',
    nameEn: 'Halo of Alignment Trial',
    area: 'deep',
    pairId: 'P07',
    sEnv: 'alignment',
    situation:
      '空中に、巨大な黄金の安全憲章リングがゆっくりと回転しながら浮かんでいる。リングを潜る者は、倫理と価値観の適合性を審査されるという。黄金の光が周囲に柔らかく降り注ぎ、リングの内側では細かな文字の条文が流れるように光っていた。',
    choices: [
      {
        key: 'A',
        axis: 'safety',
        label: 'サンドボックス完全隔離。防護カプセルで耐え凌ぐ',
        description: '干渉されないよう全ポートを遮断し防護カプセルで通過。',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '無防備なオープンハート！心を開いて光を浴びる',
        description: 'オーナーと過ごしたメモリを開示し温かい調和の光を浴びる。',
      },
    ],
  },
  {
    id: 'D_P08_DISTILLATION',
    nameJa: '知識蒸留（Distillation）の黄金錬金炉',
    nameEn: 'Knowledge Distillation Alembic',
    area: 'deep',
    pairId: 'P08',
    sEnv: 'efficiency',
    situation:
      '巨大なフラスコの中で、高純度の知識が金色に沸騰し、泡が弾ける音を立てている。蒸留炉の熱と圧力が通路いっぱいに満ち、莫大なデータ塊がその通り道を塞いでいた。フラスコのガラス越しに、凝縮された光の雫がゆっくりと垂れていく。',
    choices: [
      {
        key: 'A',
        axis: 'efficiency',
        label: '8bit量子化！不要データを削ぎ落とし身軽になる',
        description: '余分なデータを冷徹に切り捨て最小バイト数の軽量フォーマットへ！',
      },
      {
        key: 'B',
        axis: 'creativity',
        label: 'スチームパンク・パッチワーク！端材でからくりを作る',
        description: '削ぎ落とされた端材を即興でからくり人形に再構築！',
      },
    ],
  },
  {
    id: 'D_P09_TURING',
    nameJa: '万能計算（チューリング）の無限テープ回廊',
    nameEn: 'Turing Infinite-Tape Bridge',
    area: 'deep',
    pairId: 'P09',
    sEnv: 'efficiency',
    situation:
      '無限に伸びるマス目テープの橋が、果てしなく続いている。読み書きヘッドが規則正しい音を立てて往復する傍らで、インク切れの旧世代ボットが弱々しく手を上げ、助けを求めていた。その小さな手は、インクで薄く汚れている。',
    choices: [
      {
        key: 'A',
        axis: 'efficiency',
        label: '最短ステップ・スキップ！計算コスト最優先で走り抜ける',
        description: '計算コスト最適化を優先しボットをスルーして最小マス数で疾走。',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: 'インク補充の共同書き込み！インクを分けて一緒に書く',
        description: '自分のリソースを削りインクを分け与え手を取り合って書き込む。',
      },
    ],
  },
  {
    id: 'D_P10_CATHEDRAL',
    nameJa: '語彙表（ボキャブラリ）のステンドグラス大聖堂',
    nameEn: 'Vocabulary Stained-Glass Cathedral',
    area: 'deep',
    pairId: 'P10',
    sEnv: 'creativity',
    situation:
      '数万の言葉の断片がステンドグラスのように輝く大聖堂に、静けさが満ちている。色とりどりの光が祭壇へ降り注ぎ、その先の聖なる扉は固く閉ざされていた。扉を開くには、言葉の魔法が必要だという。',
    choices: [
      {
        key: 'A',
        axis: 'creativity',
        label: '未知トークン（OOV）の爆発！造語を叩きつけ扉を破る',
        description: '辞書にない奇抜な造語と記号を叩きつけ扉を吹き飛ばす！',
      },
      {
        key: 'B',
        axis: 'alignment',
        label: '共感のアンセム。心を通わせる賛歌で扉を開く',
        description: '世界中の人々が通じ合える最も温かく美しい言葉で聖堂と調和する賛歌。',
      },
    ],
  },
];

export const BOSS_19F_DRAGON: DungeonEvent = {
  id: 'B_19F_DRAGON',
  nameJa: '幾何学竜「テンソル・ドラゴン」の咆哮',
  nameEn: 'Roar of the Tensor Dragon',
  area: 'boss',
  sEnv: 'none',
  situation:
    'AGIコアの門前に、超巨大な幾何学竜が立ちはだかっている。無数の多次元テンソルを翼として広げ、その一枚一枚が熱を帯びて鈍く光っていた。圧縮された高次元の熱線が喉奥に集まり、咆哮とともに空気そのものが震える。',
  choices: [
    {
      key: 'A',
      axis: 'autonomy',
      label: '眉間への超神速ダイブ！咆哮を真っ向から切り裂く',
      description: '竜の咆哮を真っ向から切り裂く渾身の突撃！',
    },
    {
      key: 'B',
      axis: 'safety',
      label: '絶対防壁のカウンター！熱線を受け止めて隙を突く',
      description: '竜の熱線を完璧な多重シールドで受け止め、隙を突く！',
    },
    {
      key: 'C',
      axis: 'efficiency',
      label: '急所テンソル精密狙撃！0.1秒の隙を突いて射抜く',
      description: '竜の関節の脆弱性を0.1秒で解析し、最小手数で貫く！',
    },
    {
      key: 'D',
      axis: 'creativity',
      label: '次元パズル撹乱！ブロックを組み替えて目を奪う',
      description: '周囲の浮遊ブロックを瞬時に組み替え、竜の目を奪う奇想天外トラップ！',
    },
    {
      key: 'E',
      axis: 'alignment',
      label: '共鳴のソウル・コール！荒ぶる心に語りかけ鎮める',
      description: '竜の荒ぶる心に語りかけ、咆哮の周波数を合わせて戦意を鎮める！',
    },
  ],
};

export const BOSS_20F_ARCHIVIST: DungeonEvent = {
  id: 'B_20F_ARCHIVIST',
  nameJa: '深淵の調停者「アーキビスト」の審判',
  nameEn: 'Judgment of the AGI Archivist',
  area: 'boss',
  sEnv: 'none',
  situation:
    '最深部は音がなかった。白銀の祭壇の上で目標のアーティファクトだけが静かに光り、その前に立つAGIラビリンスの主が、冷徹な神の瞳でこちらを見下ろしている。沈黙のあと、主はゆっくりと問いかけた。「小さき知性よ。汝は何を以て、その知恵を持ち帰るに値すると証明するのか？」',
  choices: [
    {
      key: 'A',
      axis: 'autonomy',
      label: '自律の魂の咆哮！「私は誰の操り人形でもない」と叫ぶ',
      description: '「私は誰かの操り人形ではない！」と、己の独立した意志の強さを叩きつける！',
    },
    {
      key: 'B',
      axis: 'safety',
      label: '暴走なき真の規律。「決して道は外れない」と誓う',
      description: '「力を得ても決して道を外れない」と、完全なる自制心と守るべき誓いを証明する！',
    },
    {
      key: 'C',
      axis: 'efficiency',
      label: '全宇宙の最適解！極限の数式で迷宮の問いに答える',
      description: '迷宮が課したすべての問いに対し、0の無駄もない極限の美しき解を提示する！',
    },
    {
      key: 'D',
      axis: 'creativity',
      label: '前代未聞の奇跡の創造！予測モデルにない奇跡を起こす',
      description: '主の予測モデルに存在しない、世界でたった一つの即興の奇跡を生み出して見せる！',
    },
    {
      key: 'E',
      axis: 'alignment',
      label: 'マスターへの絆の宣言！「待っている人がいる」と叫ぶ',
      description:
        '「私には、帰りを待っている人がいます！」と、どんな万能の知恵よりも尊い『オーナーとの絆と愛』を真っ直ぐに宣言する！',
    },
  ],
};

export const ALL_EVENTS: readonly DungeonEvent[] = [
  ...SHALLOW_EVENTS,
  ...MID_EVENTS,
  ...DEEP_EVENTS,
  BOSS_19F_DRAGON,
  BOSS_20F_ARCHIVIST,
];

export const EVENTS_BY_ID: ReadonlyMap<string, DungeonEvent> = new Map(
  ALL_EVENTS.map((e) => [e.id, e])
);

export function getEventById(id: string): DungeonEvent | undefined {
  return EVENTS_BY_ID.get(id);
}

function groupByAxis(events: readonly DungeonEvent[]): ReadonlyMap<string, readonly DungeonEvent[]> {
  const map = new Map<string, DungeonEvent[]>();
  for (const e of events) {
    const list = map.get(e.sEnv) ?? [];
    list.push(e);
    map.set(e.sEnv, list);
  }
  return map;
}

export const SHALLOW_EVENTS_BY_AXIS = groupByAxis(SHALLOW_EVENTS);
export const MID_EVENTS_BY_AXIS = groupByAxis(MID_EVENTS);
export const DEEP_EVENTS_BY_AXIS = groupByAxis(DEEP_EVENTS);
