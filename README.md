# 楽曲工房 Studio (Music Lab × MIDI Studio)

ACE-Step 1.5 を使った AI 楽曲生成・管理と、Web Audio API ベースのブラウザ DAW（MIDI Studio）、AI Radio Station 連携を統合した Web アプリケーションです。

![ACE-Step](https://img.shields.io/badge/ACE--Step-1.5-orange) ![Vue 3](https://img.shields.io/badge/Vue-3-42b883) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## 機能

| 画面 | 内容 |
|------|------|
| **AI 楽曲工房** | Caption / Lyrics / メタデータ / エンジン設定で楽曲を生成（ACE-Step 未起動時は内蔵シンセエンジンで自動生成） |
| **MIDI Studio** | 8パートドラム＋ポリシンセのステップシーケンサー＆ループマトリクス。`.mid` / `.wav` 書き出し、Web MIDI 入力、ライブラリ保存、AI工房連携に対応 |
| **ライブラリ** | グリッド / リスト表示・タグ絞り込み・ソートでトラック管理（`data/tracks.json` に永続化） |
| **トラック詳細** | メタデータ編集・スコア表示・系譜・Repaint 区間選択・`.WAV`/`.LRC`/`.JSON` 書き出し・**AI Radio Station (`radio`) への送出** |
| **プレイヤーバー** | 常駐プレイヤー（波形シーク・実音声再生対応） |

## 技術スタック

- **フロントエンド:** Vue 3 + Vite + Pinia + TypeScript
- **バックエンド:** Express + TypeScript (ACE-Step REST プロキシ)
- **AI エンジン:** ACE-Step 1.5 (FastAPI 推論サーバー)
- **インフラ:** Docker Compose + Nginx (マルチステージビルド)

## ディレクトリ構成

```
music-lab/
├── .env.example                 # 環境変数テンプレート
├── docker-compose.yml           # ベース構成 (frontend + server)
├── docker-compose.full.yml      # ACE-Step GPU 拡張構成
├── scripts/
│   ├── start.sh                 # ローカル開発起動
│   ├── deploy.sh                # Docker デプロイ (frontend + server)
│   ├── deploy-full.sh           # Docker デプロイ (+ ACE-Step, GPU 必須)
│   ├── stop.sh                  # ベース構成を停止
│   └── stop-full.sh             # フル構成を停止
└── packages/
    ├── frontend/                # Vue 3 アプリ
    ├── server/                  # Express API サーバー
    └── acestep/                 # ACE-Step 推論サーバー
        ├── infer_server.py      # FastAPI (モデル起動時ロード)
        └── Dockerfile
```

## セットアップ

```bash
cp .env.example .env
# ポートを環境に合わせて調整してください
```

### A. ローカル開発（Docker なし・推奨）

ACE-Step 推論サーバーなしでも、内蔵マルチトラック・シンセサイザーおよび MIDI Studio の Web Audio エンジンだけで即座に起動・実音声生成できます。

```bash
# 依存関係インストール（初回のみ）
npm install

# フロントエンド + API サーバーを同時起動
npm run dev
# → フロントエンド: http://localhost:5200
# → API サーバー:   http://localhost:4001
```

ACE-Step 実機推論サーバーを併用する場合（GPU 環境）：

```bash
# 1. ACE-Step 推論サーバーを起動
pip install "git+https://github.com/ace-step/ACE-Step.git" fastapi "uvicorn[standard]"
python packages/acestep/infer_server.py  # → http://localhost:8000

# 2. アプリを起動
bash scripts/start.sh
```

### B. Docker — ベース構成（ACE-Step 外部起動）

```bash
bash scripts/deploy.sh
```

ACE-Step は Docker 外で起動し、`.env` の `ACESTEP_API_URL` で接続先を指定します。

### C. Docker — フル構成（ACE-Step コンテナ込み、GPU 必須）

**前提:** NVIDIA GPU + [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

```bash
bash scripts/deploy-full.sh
```

初回起動時はモデルのダウンロード（約 5GB）が行われます。`acestep-models` ボリュームにキャッシュされるため、2回目以降は高速です。

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `FRONTEND_PORT` | `5200` | フロントエンドのポート |
| `SERVER_PORT` | `4001` | API サーバーのポート |
| `ACESTEP_PORT` | `8000` | ACE-Step 推論サーバーのポート |
| `ACESTEP_API_URL` | `http://localhost:8000` | ACE-Step 接続先（フル構成では自動設定） |
| `ACESTEP_BF16` | `true` | bfloat16 使用（推奨） |
| `ACESTEP_CPU_OFFLOAD` | `false` | VRAM < 8GB の場合 `true` |

## VRAM 要件

| 設定 | 必要 VRAM |
|------|-----------|
| デフォルト (turbo, BF16) | ~8 GB |
| CPU オフロード有効 | ~6 GB |
| XL モデル | ~20 GB |

## アーキテクチャ（Docker フル構成）

```
[ブラウザ]
    ↓ :5200
[Nginx (frontend)]
    ↓ /api/   → :8001  [Express server]  ←→ audio-data volume
    ↓ /audio/ → :8001                              ↑
                              ↓ :8000  [ACE-Step] ─┘
                           (acestep-models volume)
```
