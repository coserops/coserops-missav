(() => {
    const player = window.player;

    if (!player) {
        console.log('没有找到 window.player');
        return;
    }

    if (player.__missavPausePatched) {
        console.log('已经修改过了');
        return;
    }

    const originalPause = player.pause.bind(player);

    player.pause = function (...args) {
        // 页面失去焦点时，阻止 MISSAV 自动暂停
        if (!document.hasFocus()) {
            console.log('[MISSAV] 页面失焦，已阻止自动暂停');
            return;
        }

        // 页面正常获得焦点时，允许正常暂停
        console.log('[MISSAV] 正常执行 pause()');
        return originalPause(...args);
    };

    player.__missavPausePatched = true;

    console.log('✅ MISSAV 防失焦自动暂停已开启');
    console.log('✅ 页面失焦：继续播放');
    console.log('✅ 页面获得焦点：可以正常点击暂停');
})();