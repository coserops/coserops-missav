(() => {
    const video = document.querySelector('video.player');
    if (!video) return console.log('没找到视频');

    const plyr = video.closest('.plyr');

    // 找到 .flex-1.order-first
    const videoCol = plyr.closest('.flex-1.order-first');

    if (!videoCol) {
        console.log('没找到视频列');
        return;
    }

    // 找到它所在的左右布局
    const layout = videoCol.parentElement;

    console.log('布局:', layout);

    // 只寻找位于视频右侧的兄弟元素
    [...layout.children].forEach((el, i) => {
        if (el === videoCol) return;

        const r = el.getBoundingClientRect();
        const vr = videoCol.getBoundingClientRect();

        console.log(i, el, '位置:', r.x, r.width);

        // 只有真正位于视频右边的元素才隐藏
        if (r.left >= vr.right - 10 && r.width > 100) {
            el.style.setProperty('display', 'none', 'important');
            console.log('✅ 隐藏右侧:', el);
        }
    });

    // 视频区域扩大
    videoCol.style.setProperty('flex', '1 1 100%', 'important');
    videoCol.style.setProperty('width', '100%', 'important');
    videoCol.style.setProperty('max-width', 'none', 'important');

    console.log('✅ 完成：保留下面内容，只处理右侧栏');
})();