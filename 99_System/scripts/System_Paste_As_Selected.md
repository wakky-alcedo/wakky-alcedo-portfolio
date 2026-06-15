<%*
// 1. クリップボードの中身を取得
const clip = await tp.system.clipboard();

// 2. 中身がある場合のみ実行
if (clip) {
    // 貼り付け方法を選択
    const choice = await tp.system.suggester(
        ["AI回答（引用形式）", "プロンプト形式", "テキスト整形（改行・太字解除）"],
        ["ai_answer", "prompt", "clean"]
    );
    
    if (choice === "ai_answer") {
        // 全行の先頭に "> " をつけて引用形式にする
        const quoted = clip.replace(/^/gm, "> ");
        // Calloutのヘッダーを先頭にくっつけて出力
        tR += "> [!ai_answer]- AIの回答\n" + quoted;
    } else if (choice === "prompt") {
        // 全行の先頭に "> " をつけて引用形式にする
        const quoted = clip.replace(/^/gm, "> ");
        // プロンプト形式：コードブロックで囲む
        tR += "> [!prompt]- プロンプト\n" + "> ```prompt\n" + quoted + "\n> ```";
    } else if (choice === "clean") {
        let cleaned = clip;
        // 改行コードを統一（CRLF → LF）
        cleaned = cleaned.replace(/\r\n/g, "\n");
        // 太字を解除（**text** または __text__ を text に）
        cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");
        cleaned = cleaned.replace(/__(.+?)__/g, "$1");
        // --- を削除
        cleaned = cleaned.replace(/^---$/gm, "");
        // 見出し記号を削除（## などを削除）
        cleaned = cleaned.replace(/^#+\s+/gm, "");
        // 数字の後の全角ピリオドを半角ピリオド+スペースに変換（1．→1. ）
        cleaned = cleaned.replace(/(\d+)．/g, "$1. ");
        // 空白行を削除（連続する改行を1つに）
        cleaned = cleaned.replace(/\n{2,}/g, "\n");
        tR += cleaned;
    }
}
%>