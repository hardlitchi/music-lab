# 楽曲工房

ACE-Step 1.5 を使った楽曲生成・管理・外部連携 Web アプリ

![楽曲工房](https://img.shields.io/badge/ACE--Step-1.5-orange) ![Vue 3](https://img.shields.io/badge/Vue-3-42b883) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## 機能

| 画面 | 内容 |
|------|------|
| **工房（生成）** | Caption / Lyrics / メタデータ / エンジン設定で楽曲を生成。LM→DiT→VAE→自動スコアリングのパイプラインをシミュレート |
| **ライブラリ** | グリッド / リスト表示・タグ絞り込み・ソートでトラックを管理 |
| **トラック詳細** | メタデータ編集・スコア表示・系譜・Repaint 区間選択・エクスポート・外部連携 |
| **プレイヤーバー** | 常駐プレイヤー（波形シーク対応） |

## 技術スタック

- **フロントエンド:** Vue 3 + Vite + Pinia + TypeScript
- **バックエンド:** Express + TypeScript (ACE-Step REST プロキシ)
- **インフラ:** Docker Compose + Nginx (マルチステージビルド)

## ディレクトリ構成

```
music-lab/
├── .env.example          # 環境変数テンプレート
├── docker-compose.yml    # 本番デプロイ
├── scripts/
│   ├── start.sh          # ローカル開発起動
│   ├── build.sh          # Docker イメージビルド
│   ├── deploy.sh         # ビルド + デプロイ
│   └── stop.sh           # コンテナ停止
├── packages/
│   ├── frontend/         # Vue 3 アプリ (Vite + Pinia)
│   └── server/           # Express API サーバー
```

## セットアップ

```bash
# 1. 環境変数を設定
cp .env.example .env
# ポートは環境に合わせて変更してください

# 2a. ローカル開発 (Docker 不要)
bash scripts/start.sh

# 2b. Docker でデプロイ
bash scripts/deploy.sh
```

### 環境変数 (`.env`)

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `FRONTEND_PORT` | `5200` | フロントエンドのポート |
| `SERVER_PORT` | `4001` | API サーバーのポート |
| `VITE_API_BASE_URL` | `http://localhost:4001` | フロントエンドからの API 接続先 |
| `CORS_ORIGIN` | `http://localhost:5200` | CORS 許可オリジン |
| `ACESTEP_API_URL` | `http://localhost:8001` | ACE-Step ローカルサーバー URL |

## スクリプト

```bash
bash scripts/start.sh    # ローカル開発モード (npm dev)
bash scripts/build.sh    # Docker イメージビルド
bash scripts/deploy.sh   # デプロイ (build + docker compose up -d)
bash scripts/stop.sh     # コンテナ停止
```

## 備考

現在の生成処理は **モック動作** です。実運用には ACE-Step をローカルで起動し、`ACESTEP_API_URL` を設定してください。

```bash
# ACE-Step 起動後 (.env に設定)
ACESTEP_API_URL=http://localhost:8001
```
