
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.35.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.35.0 */

    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let p0;
    	let t3;
    	let t4;
    	let t5;
    	let button;
    	let t7;
    	let p1;
    	let t8;
    	let t9;
    	let t10;
    	let and_button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text(/*title*/ ctx[0]);
    			t1 = text("!");
    			t2 = space();
    			p0 = element("p");
    			t3 = text("We can count! ");
    			t4 = text(/*counter*/ ctx[1]);
    			t5 = space();
    			button = element("button");
    			button.textContent = "Standard Button";
    			t7 = space();
    			p1 = element("p");
    			t8 = text("We can't count! ");
    			t9 = text(/*andCounter*/ ctx[2]);
    			t10 = space();
    			and_button = element("and-button");
    			attr_dev(h1, "class", "svelte-1tky8bj");
    			add_location(h1, file, 12, 1, 182);
    			add_location(p0, file, 13, 1, 201);
    			attr_dev(button, "label", "button");
    			add_location(button, file, 14, 1, 233);
    			add_location(p1, file, 16, 1, 307);
    			set_custom_element_data(and_button, "primary", "true");
    			set_custom_element_data(and_button, "label", "AND Button");
    			add_location(and_button, file, 17, 1, 344);
    			attr_dev(main, "class", "svelte-1tky8bj");
    			add_location(main, file, 11, 0, 174);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(main, t2);
    			append_dev(main, p0);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(main, t5);
    			append_dev(main, button);
    			append_dev(main, t7);
    			append_dev(main, p1);
    			append_dev(p1, t8);
    			append_dev(p1, t9);
    			append_dev(main, t10);
    			append_dev(main, and_button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*handleClick*/ ctx[3], false, false, false),
    					listen_dev(and_button, "click", /*handleAndClick*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*title*/ 1) set_data_dev(t0, /*title*/ ctx[0]);
    			if (dirty & /*counter*/ 2) set_data_dev(t4, /*counter*/ ctx[1]);
    			if (dirty & /*andCounter*/ 4) set_data_dev(t9, /*andCounter*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { title } = $$props;
    	let counter = 0;
    	let andCounter = 0;

    	function handleClick() {
    		$$invalidate(1, counter++, counter);
    	}

    	function handleAndClick() {
    		$$invalidate(2, andCounter++, andCounter);
    	}

    	const writable_props = ["title"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	$$self.$capture_state = () => ({
    		title,
    		counter,
    		andCounter,
    		handleClick,
    		handleAndClick
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("counter" in $$props) $$invalidate(1, counter = $$props.counter);
    		if ("andCounter" in $$props) $$invalidate(2, andCounter = $$props.andCounter);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, counter, andCounter, handleClick, handleAndClick];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { title: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !("title" in props)) {
    			console.warn("<App> was created without expected prop 'title'");
    		}
    	}

    	get title() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function t(){}function e(t){return t()}function n(){return Object.create(null)}function o(t){t.forEach(e);}function r(t){return "function"==typeof t}function s(t,e){return t!=t?e==e:t!==e||t&&"object"==typeof t||"function"==typeof t}function i(t,e,n){t.insertBefore(e,n||null);}function c(t){t.parentNode.removeChild(t);}function a(t){return document.createElement(t)}function l(t){return document.createTextNode(t)}function d(t,e,n){null==n?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n);}let u;function p(t){u=t;}function f(){if(!u)throw new Error("Function called outside component initialization");return u}function b(){const t=f();return (e,n)=>{const o=t.$$.callbacks[e];if(o){const r=function(t,e){const n=document.createEvent("CustomEvent");return n.initCustomEvent(t,!1,!1,e),n}(e,n);o.slice().forEach(e=>{e.call(t,r);});}}}const h=[],y=[],$=[],m=[],g=Promise.resolve();let k=!1;function v(t){$.push(t);}let x=!1;const E=new Set;function _(){if(!x){x=!0;do{for(let t=0;t<h.length;t+=1){const e=h[t];p(e),w(e.$$);}for(p(null),h.length=0;y.length;)y.pop()();for(let t=0;t<$.length;t+=1){const e=$[t];E.has(e)||(E.add(e),e());}$.length=0;}while(h.length);for(;m.length;)m.pop()();k=!1,x=!1,E.clear();}}function w(t){if(null!==t.fragment){t.update(),o(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(v);}}const C=new Set;function F(t,e){-1===t.$$.dirty[0]&&(h.push(t),k||(k=!0,g.then(_)),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31;}function j(s,i,a,l,d,f,b=[-1]){const h=u;p(s);const y=i.props||{},$=s.$$={fragment:null,ctx:null,props:f,update:t,not_equal:d,bound:n(),on_mount:[],on_destroy:[],before_update:[],after_update:[],context:new Map(h?h.$$.context:[]),callbacks:n(),dirty:b,skip_bound:!1};let m=!1;if($.ctx=a?a(s,y,(t,e,...n)=>{const o=n.length?n[0]:e;return $.ctx&&d($.ctx[t],$.ctx[t]=o)&&(!$.skip_bound&&$.bound[t]&&$.bound[t](o),m&&F(s,t)),e}):[],$.update(),m=!0,o($.before_update),$.fragment=!!l&&l($.ctx),i.target){if(i.hydrate){const t=function(t){return Array.from(t.childNodes)}(i.target);$.fragment&&$.fragment.l(t),t.forEach(c);}else $.fragment&&$.fragment.c();i.intro&&((g=s.$$.fragment)&&g.i&&(C.delete(g),g.i(k))),function(t,n,s){const{fragment:i,on_mount:c,on_destroy:a,after_update:l}=t.$$;i&&i.m(n,s),v(()=>{const n=c.map(e).filter(r);a?a.push(...n):o(n),t.$$.on_mount=[];}),l.forEach(v);}(s,i.target,i.anchor),_();}var g,k;p(h);}let A;"function"==typeof HTMLElement&&(A=class extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"});}connectedCallback(){for(const t in this.$$.slotted)this.appendChild(this.$$.slotted[t]);}attributeChangedCallback(t,e,n){this[t]=n;}$destroy(){!function(t,e){const n=t.$$;null!==n.fragment&&(o(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[]);}(this,1),this.$destroy=t;}$on(t,e){const n=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return n.push(e),()=>{const t=n.indexOf(e);-1!==t&&n.splice(t,1);}}$set(t){var e;this.$$set&&(e=t,0!==Object.keys(e).length)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1);}});var L={dispatch(t,e,n){t.dispatchEvent&&t.dispatchEvent(new CustomEvent(e,{detail:n}));},dispatchCustomEvent(t,e,n){let o={};e&&e.type&&e.target&&(o={type:e.type,target:e.target},n||(n=e.type)),this.dispatch(t,n,o);}};function T(e){let n,o,r,s,u,p,f;return {c(){n=a("link"),o=l(" "),r=a("button"),s=l(e[1]),this.c=t,d(n,"rel","stylesheet"),d(n,"href","and-component-styles.css"),d(n,"disabled",e[4]),d(r,"id",e[2]),d(r,"type",e[0]),d(r,"class",u=["storybook-button",e[5],e[3]].join(" ")),r.disabled=e[6];},m(t,c){var a,l,d,u;i(t,n,c),i(t,o,c),i(t,r,c),function(t,e){t.appendChild(e);}(r,s),p||(a=r,l="click",d=e[7],a.addEventListener(l,d,u),f=()=>a.removeEventListener(l,d,u),p=!0);},p(t,[e]){16&e&&d(n,"disabled",t[4]),2&e&&function(t,e){e=""+e,t.wholeText!==e&&(t.data=e);}(s,t[1]),4&e&&d(r,"id",t[2]),1&e&&d(r,"type",t[0]),40&e&&u!==(u=["storybook-button",t[5],t[3]].join(" "))&&d(r,"class",u),64&e&&(r.disabled=t[6]);},i:t,o:t,d(t){t&&c(n),t&&c(o),t&&c(r),p=!1,f();}}}function M(t,e,n){let{primary:o}=e,{type:r="button"}=e,{label:s=""}=e,{id:i="and-button"}=e,{class:c=""}=e,{disabled:a=!1}=e,{overidestyle:l=!1}=e;const d=f(),u=b();let p,h,y;return t.$$set=t=>{"primary"in t&&n(8,o=t.primary),"type"in t&&n(0,r=t.type),"label"in t&&n(1,s=t.label),"id"in t&&n(2,i=t.id),"class"in t&&n(3,c=t.class),"disabled"in t&&n(9,a=t.disabled),"overidestyle"in t&&n(10,l=t.overidestyle);},t.$$.update=()=>{1024&t.$$.dirty&&n(4,p=!l||null),256&t.$$.dirty&&n(5,h=o?"storybook-button--primary":"storybook-button--secondary"),512&t.$$.dirty&&n(6,y=a?"true":"");},[r,s,i,c,p,h,y,function(t){u("click",t),L.dispatchCustomEvent(d,t,"click");},o,a,l]}class z extends A{constructor(t){super(),this.shadowRoot.innerHTML="<style>@import url(https://fonts.googleapis.com/css2?family=Poppins);:root{--step:50}.storybook-button{font-family:'Poppins', sans-serif;font-size:16px;font-size:torem(16px);border:0;min-width:6.25rem;min-height:2.5rem;border-radius:0.625rem;cursor:pointer;display:inline-block;line-height:1;padding:0.5rem 1.4375rem}.storybook-button--primary{color:white;background-color:#FF323C}.storybook-button--primary:hover{background:#e5000b}.storybook-button--primary:focus{outline:0;background:#980007}.storybook-button--primary:disabled{color:#FF323C;background:#ffcbce}.storybook-button--secondary{color:white;background-color:#2897FF}.storybook-button--secondary:hover{background:#0071db}.storybook-button--secondary:focus{background:#00498e}.storybook-button--secondary:disabled{color:#2897FF;background:#c1e1ff}</style>",j(this,{target:this.shadowRoot},M,T,s,{primary:8,type:0,label:1,id:2,class:3,disabled:9,overidestyle:10}),t&&(t.target&&i(t.target,this,t.anchor),t.props&&(this.$set(t.props),_()));}static get observedAttributes(){return ["primary","type","label","id","class","disabled","overidestyle"]}get primary(){return this.$$.ctx[8]}set primary(t){this.$set({primary:t}),_();}get type(){return this.$$.ctx[0]}set type(t){this.$set({type:t}),_();}get label(){return this.$$.ctx[1]}set label(t){this.$set({label:t}),_();}get id(){return this.$$.ctx[2]}set id(t){this.$set({id:t}),_();}get class(){return this.$$.ctx[3]}set class(t){this.$set({class:t}),_();}get disabled(){return this.$$.ctx[9]}set disabled(t){this.$set({disabled:t}),_();}get overidestyle(){return this.$$.ctx[10]}set overidestyle(t){this.$set({overidestyle:t}),_();}}customElements.define("and-button",z);

    const app = new App({
        target: document.body,
        props: {
            title: 'Monte Carlo Sim'
        }
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
