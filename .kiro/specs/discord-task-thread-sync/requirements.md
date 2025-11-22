# Requirements Document

## Introduction
byTech の TaskThreadSync Service は Google Drive 上の本番タスク管理スプレッドシートを唯一のデータベースとして扱い、プロジェクトIDと子タスクIDに基づく階層データを Discord フォーラムスレッドへ同期します。通知およびスレッド更新は 30 分ごとのバッチトリガーを基本とし、シート更新ごとにトリガーさせる実装は複雑化リスクが高いため対象外とします。本仕様では、J列に保管するスレッドIDの自動生成・書き戻し、子タスク情報の通知フォーマット、完了率の算出とスレッド表示更新を含むプロトタイプ要件を定義します。

## Requirements

### Requirement 1: プロジェクト/タスク階層データ同期
**Objective:** As a 運用オーナー, I want 親子タスクを確実にグルーピングした上で進捗把握できるようにしたい, so that Discord 通知が常に正しいタスク集合を参照できます。

#### Acceptance Criteria
1. When 本番スプレッドシートからタスク行を読み込むとき, the TaskThreadSync Service shall プロジェクトID列を用いて親タスク行を識別する。
2. When 子タスク行を解析するとき, the TaskThreadSync Service shall タスクID・タスク名・タスク内容・タスク開始日・タスク期限・進行ステータス・タスク完了日・'備考／コメント欄'を保持して親プロジェクトに紐づける。
3. While プロジェクトに紐づく子タスクが存在するとき, the TaskThreadSync Service shall 総件数と完了件数を集計する。
4. While 完了件数と総件数が集計済みであるとき, the TaskThreadSync Service shall 完了率を少なくとも整数パーセント精度で計算する。完了の定義は進行ステータス＝完了とする。
5. The TaskThreadSync Service shall Google Drive 上の本番スプレッドシートのみを同期対象とし、ローカルサンプルファイルを参照しない。

### Requirement 2: Discord スレッド連携とJ列管理
**Objective:** As a プロジェクト管理者, I want プロジェクトIDごとのスレッド生成と追跡を自動化したい, so that 人手を介さずに通知先との紐付けを維持できます。

#### Acceptance Criteria
1. When 親タスク行のJ列にスレッドIDが存在しないとき, the TaskThreadSync Service shall Discordフォーラムに新規スレッドを作成する。
2. When 新規スレッドIDを取得したとき, the TaskThreadSync Service shall 同じ親タスク行のJ列へIDを書き込む。
3. When 親タスク行のJ列にスレッドIDが既に存在するとき, the TaskThreadSync Service shall 既存スレッドを再利用して通知を送信する。
4. If Discord API がスレッド作成エラーを返すとき, the TaskThreadSync Service shall エラーログを記録しJ列更新をスキップして再実行可否を通知する。

### Requirement 3: 子タスク通知コンテンツ
**Objective:** As a チームメンバー, I want Discord 上で必要十分なタスク情報を受け取りたい, so that スプレッドシートを開かなくても対応状況を把握できます。

#### Acceptance Criteria
1. When 同期サイクルが開始するとき, the TaskThreadSync Service shall 各プロジェクトスレッドに子タスクのタスクID・タイトル・担当者・期限・ステータスを一覧化したメッセージを投稿する。
2. When 子タスクの期限またはステータスが前回同期以降に変化したとき, the TaskThreadSync Service shall 該当タスクの変更点を同じメッセージ内で明示する。
3. Where 子タスクに必須項目が欠落しているとき, the TaskThreadSync Service shall 当該タスクを通知対象から除外し補完が必要である旨を記録する。
4. While Discord スレッドがアクティブであるとき, the TaskThreadSync Service shall 親プロジェクトIDと現在日時をメッセージ先頭に表示する。

### Requirement 4: 完了率表示と更新サイクル
**Objective:** As a ステークホルダー, I want スレッド単位で最新の完了率を即時に確認したい, so that 進捗遅延を早期に検知できます。

#### Acceptance Criteria
1. When 完了率が前回同期から変化したとき, the TaskThreadSync Service shall スレッド名または最上部メッセージに最新の完了率（例: 60%）を反映する。
2. While 子タスク件数が1件以上存在するとき, the TaskThreadSync Service shall 完了率を 完了件数/総件数×100 として計算し分子分母を同じメッセージに記載する。
3. If 子タスク件数が0のとき, the TaskThreadSync Service shall 完了率0%と未登録の旨を表示する。
4. When 完了率を投稿したとき, the TaskThreadSync Service shall 同じ値を内部ステータスに保存して次回比較を可能にする。
5. While 定期トリガーが動作するとき, the TaskThreadSync Service shall 30 分間隔で同期ジョブを実行し、これより高頻度のシート更新トリガーは採用しない理由（実装複雑化）を運用ドキュメントに残す。
