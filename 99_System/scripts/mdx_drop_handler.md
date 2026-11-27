<%*
// 二重登録防止フラグ
if (window.__mdxDropHandlerRegistered) {
    console.log("[MDX-Drop] Handler already registered.");
    return;
}

console.log("[MDX-Drop] Initializing MDX Image Drop Handler...");

const VAULT_ASSETS_DIR = "src/assets/images"; 
const MDX_RELATIVE_DIR = "../../assets/images";

window.addEventListener('drop', async (event) => {
    const activeView = app.workspace.getActiveViewOfType(tp.obsidian.MarkdownView);
    if (!activeView) return;

    const files = event.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    event.preventDefault();
    event.stopPropagation();

    try {
        const caption = await tp.system.prompt("画像のキャプション（alt/caption共通）を入力してください:");
        if (caption === null) return;

        const now = new Date();
        const timestamp = now.getFullYear() + 
            String(now.getMonth() + 1).padStart(2, '0') + 
            String(now.getDate()).padStart(2, '0') + "_" + 
            String(now.getHours()).padStart(2, '0') + 
            String(now.getMinutes()).padStart(2, '0') + 
            String(now.getSeconds()).padStart(2, '0');
        
        const ext = file.name.split('.').pop() || 'jpg';
        const newFileName = `${timestamp}.${ext}`;
        const variableName = `img_${timestamp}`;

        const vaultSavePath = `${VAULT_ASSETS_DIR}/${newFileName}`; 
        const mdxRelativePath = `${MDX_RELATIVE_DIR}/${newFileName}`;

        const arrayBuffer = await file.arrayBuffer();
        await app.vault.createBinary(vaultSavePath, arrayBuffer);

        const mdxString = `import ${variableName} from '${mdxRelativePath}';\n\n<CustomImage src={${variableName}} alt="${caption}" width={100} caption="${caption}" />\n`;

        const editor = activeView.editor;
        editor.replaceSelection(mdxString);
        console.log("[MDX-Drop] MDX components successfully injected.");

    } catch (error) {
        console.error("[MDX-Drop] Critical error during processing:", error);
    }
}, true);

window.__mdxDropHandlerRegistered = true;
console.log("[MDX-Drop] Registration successful.");
%>