<%*
// ガード句：テンプレートフォルダ内のファイル、または Untitled 以外のファイルなら実行しない 
if (!tp.file.title.includes("Untitled")) {
		return;
}
// 1. 入力ダイアログを表示  
let filename = await tp.system.prompt("ファイル名を入力してください");  
// 2. 入力がなければデフォルト名（Untitledのまま）   
if (filename == null || filename == "") { filename = tp.file.title; }  
// 3. ファイルをリネーム   
await tp.file.rename(filename);   
// ファイルの場所を変更  
const targetFolder = "src/content/works";   
await tp.file.move(`${targetFolder}/${filename}`);

// タイトル
// 1. 入力ダイアログを表示  
let title = await tp.system.prompt("タイトルを入力してください");  
if (title == null || title == "") { title = tp.file.title; }  
%>---
title: 対戦型列車戦（工華祭）
description: 高専の文化祭「工華祭」に出展した，対戦型の戦車ロボットで打ち合うゲーム企画です．
date: <% tp.file.creation_date() %>
thumbnail: ../../assets/images/thumbnail_work1.webp
tags:
  - ロボット
  - 文化祭
draft: false
---
# <% title %>

## 概要

高専の文化祭「工華祭」に出展した，対戦型の戦車ロボットで打ち合うゲーム企画です．

横移動する 装甲列車ロボット（以下，走行列車） で撃ち合い， 相手の HP を削っていくバトルゲームです． 装甲列車の全長は 300mm ほどで， 向き合うように置かれており， コントローラで操縦します． 装甲列車側面には的がついており，相手の的に弾を当てることで， HP を削ります． HP がなくなる ，あるいはタイムアップによりゲームが終了し， 終了時の HP が高い方が勝利となります．
## 使用技術

- ROS2 Humble
- Python / C++
- YOLO11による物体検出
## 成果

予選を突破し、本戦に出場することができました。

## 関連リンク
- 公式Twitter：[工華祭5M 対戦型列車戦](https://twitter.com/5mclasskikaku) ([@5mclasskikaku](https://twitter.com/5mclasskikaku))  
- 公式Instagram：[群馬高専工華祭5M 対戦型列車戦](https://www.instagram.com/nitgc_kokasai5m/) ([@nitgc_kokasai5m](https://www.instagram.com/nitgc_kokasai5m/#))
- 当時の報告記事：[工華祭(文化祭)で射的ロボットを作った話｜wakky]
- GitHubリポジトリ：