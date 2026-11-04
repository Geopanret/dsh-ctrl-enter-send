/**
 * dsh-ctrl-enter-send — Client half.
 *
 * 痛点：中文输入法停在英文模式打字时，Enter 太容易误触发送，提示词还没写完就
 * 被发给了 AI。
 *
 * 目标：主对话输入框里 Enter 只换行，Ctrl+Enter（macOS 为 Cmd+Enter）才发送。
 *
 * 做法：在 window 捕获阶段改写 keydown 事件实例上的修饰键，让 ui-conversation
 * 本来就有、但只认 Enter 的 composer keymap 走进另一条既有分支：
 *   shiftKey === true          → 插入换行（本来的 Shift+Enter）
 *   ctrlKey/metaKey === false  → 走「普通 Enter」发送（与发送按钮同一个手势）
 * 因此不替换 UI、不注册槽位、不改内置配置；插件停用即恢复原样。
 *
 * 输入框 DOM 契约（DSH 0.2.1-rc.x 的 ui-conversation）：
 *   [data-composer-input]        可编辑根（contenteditable）
 *   [data-composer-card]         输入框卡片
 *   [data-trigger-menu]          / 与 @ 的候选菜单（打开时 Enter 用于选择）
 *   [role="listbox"]             候选菜单视口（菜单标记的后备）
 *   [data-composer-placeholder]  空草稿占位（存在即草稿为空）
 *
 * 任何一步判断不出来时都放行内置行为；最坏情况是「改动没生效」，不会误发送。
 */

window.__ModuleLoader__.load({
  id: 'dsh-ctrl-enter-send',
  factory() {
    /** 合成的兜底事件标记，避免自己再处理一遍（全局 Symbol，跨模块实例也有效）。 */
    const REPLAY = Symbol.for('dsh-ctrl-enter-send/replay');
    /** 单次事件只处理一次，避免重复安装或多个实例时连续改写。 */
    const HANDLED = Symbol.for('dsh-ctrl-enter-send/handled');

    const COMPOSER_INPUT = '[data-composer-input]';
    const COMPOSER_CARD = '[data-composer-card]';
    const COMPOSER_OVERLAY = '[data-composer-overlay]';
    const COMPOSER_PLACEHOLDER = '[data-composer-placeholder]';
    // 候选菜单打开时把 Enter 让给内置菜单裁决（选择高亮项）。
    // 主标记是 data-trigger-menu；后备只认「输入框浮层里的 listbox」，
    // 避免把 composer 卡片里其他组件常驻的 listbox 误判成菜单。
    const MENU_OPEN = '[data-trigger-menu], [data-composer-overlay] [role="listbox"]';

    /** 输入法组词期间（含组词刚结束的窗口）不碰 Enter，否则会打乱候选上屏。 */
    function isComposing(event, input) {
      return event.isComposing === true
        || event.keyCode === 229
        || input.hasAttribute('data-composer-composing');
    }

    function isAltGraph(event) {
      return typeof event.getModifierState === 'function'
        && event.getModifierState('AltGraph') === true;
    }

    /**
     * 把事件实例上的修饰键改成目标值；全部生效返回 true。
     * shiftKey/ctrlKey/metaKey 是 DOM 原型上的访问器，在实例上定义自有属性
     * 即可覆盖（事件对象可扩展），后续所有监听器读到的就是新值。
     */
    function shadowFlags(event, flags) {
      let ok = true;
      for (const key of Object.keys(flags)) {
        const value = flags[key];
        try {
          Object.defineProperty(event, key, { value, configurable: true });
        } catch {
          ok = false;
        }
        if (event[key] !== value) ok = false;
      }
      return ok;
    }

    /** 覆盖失败时的兜底：拦住原事件，重放一个带目标修饰键的合成 Enter。 */
    function replayKeyDown(event, input, flags) {
      try {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        const replay = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
          composed: true,
          shiftKey: flags.shiftKey === true,
          ctrlKey: flags.ctrlKey === true,
          metaKey: flags.metaKey === true,
        });
        Object.defineProperty(replay, REPLAY, { value: true });
        input.dispatchEvent(replay);
      } catch {
        // 合成也失败时宁可「不发送」：误发半截提示词才是要解决的问题。
      }
    }

    function rewrite(event, input, flags) {
      if (shadowFlags(event, flags)) return;
      replayKeyDown(event, input, flags);
    }

    function onKeyDown(event) {
      try {
        if (event[REPLAY] === true || event[HANDLED] === true) return;
        if (event.key !== 'Enter') return;
        if (event.defaultPrevented) return;

        const target = event.target;
        if (!(target instanceof Element)) return;
        const input = target.closest(COMPOSER_INPUT);
        if (input === null || input.isContentEditable !== true) return;

        // 从这里开始只由本插件裁决这一次 Enter（重复实例直接跳过）。
        try {
          Object.defineProperty(event, HANDLED, { value: true });
        } catch {
          // 标记失败不影响下面的判断。
        }

        if (isComposing(event, input)) return;
        if (isAltGraph(event)) return;
        if (event.altKey) return;
        // Ctrl+Shift / Cmd+Shift 这类组合内置直接消费，保持原样。
        if (event.shiftKey && (event.ctrlKey || event.metaKey)) return;
        // 同时按 Ctrl 与 Cmd/Meta 内置也直接消费，不趁机发送。
        if (event.ctrlKey && event.metaKey) return;

        const card = input.closest(COMPOSER_CARD);
        const scope = card !== null ? card : document;
        if (scope.querySelector(MENU_OPEN) !== null) return;

        // Shift+Enter 原本就是换行，无需改写。
        if (event.shiftKey) return;

        if (event.ctrlKey || event.metaKey) {
          // 空草稿：保留内置「Cmd/Ctrl+Enter 插话发送全部排队消息」手势。
          if (scope.querySelector(COMPOSER_PLACEHOLDER) !== null) return;
          rewrite(event, input, { ctrlKey: false, metaKey: false });
          return;
        }

        // 纯 Enter：改成内置的换行分支。
        rewrite(event, input, { shiftKey: true });
      } catch (error) {
        // 插件绝不把异常抛给宿主；出错时保留内置行为。
        console.error('[ctrl-enter-send] Enter handling failed', error);
      }
    }

    function apply(ctx) {
      try {
        console.info('[ctrl-enter-send] Enter → 换行，Ctrl/Cmd+Enter → 发送');
      } catch {
        // 控制台不可用不影响功能。
      }
      try {
        ctx.effect(() => {
          window.addEventListener('keydown', onKeyDown, true);
          return () => window.removeEventListener('keydown', onKeyDown, true);
        }, 'ctrl-enter-send: composer Enter capture');
      } catch (error) {
        // 激活失败只让功能不生效，绝不把异常抛给宿主（客户端启动器会把
        // 未激活的插件条目判为启动失败）。
        console.error('[ctrl-enter-send] activation failed', error);
      }
    }

    return { apply };
  },
});
