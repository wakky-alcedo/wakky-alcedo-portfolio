<%*
// 1. クリップボードの中身を取得
const clip = await tp.system.clipboard();

// 2. 中身がある場合のみ実行
if (clip) {
    // 全行の先頭に "> " をつけて引用形式にする
    const quoted = clip.replace(/^/gm, "> ");
    
    // 3. Calloutのヘッダーを先頭にくっつけて出力
    // "\n" は改行という意味です
    tR += "> [!ai]- Geminiの回答\n" + quoted;
}
%>