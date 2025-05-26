const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// مفاتيح لتخزين الحالة في globalState
const INSTALLED_BEFORE_KEY = 'msDevTheme.installedBefore'; // لمعرفة إذا تم التثبيت مسبقًا
const LAST_VERSION_KEY = 'msDevTheme.lastVersionShown';   // لتخزين آخر إصدار تم عرض "What's New" له

/**
 * يعرض ملف Markdown في نافذة معاينة.
 * @param {vscode.ExtensionContext} context سياق الإضافة.
 * @param {string} mdFileName اسم ملف Markdown (مثل 'WHATS_NEW.md').
 * @param {string} viewColumn العمود الذي ستظهر فيه المعاينة (اختياري).
 */
async function showMarkdownPreview(context, mdFileName, viewColumn = vscode.ViewColumn.One) {
    const filePath = path.join(context.extensionPath, mdFileName);

    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`MS Dev Theme: Could not find the file ${mdFileName}`);
        return;
    }

    // استبدال ${EXTPATH} بالمسار الفعلي للإضافة لتعمل الروابط الداخلية بشكل صحيح
    let content = fs.readFileSync(filePath, 'utf8');
    const extensionUri = vscode.Uri.file(context.extensionPath);
    content = content.replace(/\$\{EXTPATH\}/g, extensionUri.toString());

    // إنشاء ملف مؤقت لعرضه. هذا ضروري لضمان عمل الروابط التي تعتمد على مسار الإضافة.
    // يمكن استخدام Webview API لعرض أكثر تقدماً، ولكن هذا أبسط.
    const tempDir = context.globalStorageUri.fsPath;
    if (!fs.existsSync(tempDir)) {
        try {
            fs.mkdirSync(tempDir, { recursive: true });
        } catch (err) {
            console.error("MS Dev Theme: Failed to create globalStorageUri directory:", err);
            vscode.window.showErrorMessage("MS Dev Theme: Failed to create temporary directory for showing content.");
            // كحل بديل، يمكن محاولة عرض الملف الأصلي مباشرة ولكن الروابط ${EXTPATH} قد لا تعمل
            const originalFileUri = vscode.Uri.file(filePath);
            vscode.commands.executeCommand('markdown.showPreview', originalFileUri, viewColumn);
            return;
        }
    }

    const tempFileName = `ms_dev_theme_temp_${mdFileName}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    try {
        fs.writeFileSync(tempFilePath, content);
        const tempFileUri = vscode.Uri.file(tempFilePath);
        await vscode.commands.executeCommand('markdown.showPreview', tempFileUri, viewColumn);
    } catch (err) {
        console.error(`MS Dev Theme: Failed to write or show temp markdown file ${tempFileName}:`, err);
        vscode.window.showErrorMessage(`MS Dev Theme: Could not display ${mdFileName}.`);
        // كحل بديل في حالة فشل الكتابة/العرض للملف المؤقت
        const originalFileUri = vscode.Uri.file(filePath);
        vscode.commands.executeCommand('markdown.showPreview', originalFileUri, viewColumn);
    }
}


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('MS Dev Theme is now active!');

    const currentVersion = context.extension.packageJSON.version;
    const lastVersionShown = context.globalState.get(LAST_VERSION_KEY);
    const installedBefore = context.globalState.get(INSTALLED_BEFORE_KEY);

    // تأخير بسيط لإعطاء VS Code فرصة للتحميل الكامل قبل عرض أي نوافذ
    setTimeout(async () => {
        if (!installedBefore) {
            // هذا هو التثبيت الأول للإضافة
            console.log('MS Dev Theme: First install detected. Showing Thank You page.');
            await showMarkdownPreview(context, 'THANK_YOU.md', vscode.ViewColumn.One);
            await context.globalState.update(INSTALLED_BEFORE_KEY, true);
            await context.globalState.update(LAST_VERSION_KEY, currentVersion);
        } else if (lastVersionShown !== currentVersion) {
            // تم تحديث الإضافة إلى إصدار جديد
            console.log(`MS Dev Theme: Update detected from ${lastVersionShown} to ${currentVersion}. Showing What's New page.`);
            await showMarkdownPreview(context, 'WHATS_NEW.md', vscode.ViewColumn.One);
            await context.globalState.update(LAST_VERSION_KEY, currentVersion);
        }
    }, 100);

    // تسجيل الأوامر لتكون متاحة من لوحة الأوامر
    let showWhatsNewDisposable = vscode.commands.registerCommand('msdevtheme.showWhatsNew', async () => {
        await showMarkdownPreview(context, 'WHATS_NEW.md');
    });
    context.subscriptions.push(showWhatsNewDisposable);

    let showThankYouDisposable = vscode.commands.registerCommand('msdevtheme.showThankYouPage', async () => {
        await showMarkdownPreview(context, 'THANK_YOU.md');
    });
    context.subscriptions.push(showThankYouDisposable);


// امر مسح globalState
vscode.commands.registerCommand('msdevtheme.resetState', async () => {
    await context.globalState.update('msDevTheme.installedBefore', undefined);
    await context.globalState.update('msDevTheme.lastVersionShown', undefined);
    vscode.window.showInformationMessage('تمت إعادة تعيين حالة الإضافة.');
});
}

function deactivate() {
    // يمكن وضع كود التنظيف هنا إذا لزم الأمر
    // على سبيل المثال، حذف الملفات المؤقتة (اختياري لأن VS Code قد يحذفها تلقائيًا)
    // const tempThankYouPath = path.join(vscode.workspace.globalStorageUri.fsPath, 'ms_dev_theme_temp_THANK_YOU.md');
    // const tempWhatsNewPath = path.join(vscode.workspace.globalStorageUri.fsPath, 'ms_dev_theme_temp_WHATS_NEW.md');
    // try {
    //     if (fs.existsSync(tempThankYouPath)) fs.unlinkSync(tempThankYouPath);
    //     if (fs.existsSync(tempWhatsNewPath)) fs.unlinkSync(tempWhatsNewPath);
    // } catch (err) {
    //     console.error("MS Dev Theme: Error deleting temp files on deactivate:", err);
    // }
}

module.exports = {
    activate,
    deactivate
};