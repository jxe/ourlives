(function(){

	// some rad extensions to firebase itself

	var dyns = [], vars = {};


	// like 'child' except it supports "dynamic paths"
	// with on() subscriptions that get remade when the 
	// paths change
	Firebase.prototype.dynamic = function(path){
		var dyn = {
			root:this,
			path:path,
			expanded_path: null,
			live_ref: null,
			subs: [],

			uses_var: function(v){
				return this.path.indexOf(v) != -1;
			},
			expand_path: function(){
				var incomplete = false;
				var expanded = this.path.replace(/\$(\w+)/g, function(match){
					if (!vars[match]) incomplete = true;
					else return vars[match];
				});
				if (!incomplete) return expanded;
			},
			is_path_up_to_date: function(){
				return (this.expanded_path && this.expanded_path == this.expand_path());
			},
			update_ref: function(){
				var new_path = this.expand_path();
				if (new_path != this.expanded_path){
					this.teardown_subs();
					this.live_ref = null;
					this.expanded_path = null;
					if (new_path){
						this.expanded_path = new_path;
						this.live_ref = this.ref_for_expanded_path(new_path);
						this.setup_subs();
					}
				}
			},
			ref_for_expanded_path: function(path){
				var m, rx = /\[(\d*)\]$/;
				if (m = path.match(rx)){
					path = path.replace(rx, '');
					if (Number(m[1])) return this.root.child(path).limit(Number(m[1]));
				}
				return this.root.child(path);
			},
			teardown_subs: function(){
				var ref = this.live_ref;
				if (!ref) return;
				this.subs.forEach(function(s){
					ref.off(s[0], s[1]);
				});
				this.on_cleared && this.on_cleared();
			},
			setup_subs: function(){
				var ref = this.live_ref;
				if (!ref) return;
				this.subs.forEach(function(s){ ref.on(s[0], s[1]); });
			},
			on: function(ev, cb){
				if (ev == 'cleared'){
					this.on_cleared = cb;
				} else {
					this.subs.push([ev, cb]);
					if (this.live_ref) this.live_ref.on(ev,cb);
				}
			}
		};
		dyn.update_ref();
		dyns.push(dyn);
		return dyn;
	};

	Firebase.prototype.param = function(v, value){
		if (value === undefined) return vars[v];
		vars[v] = value;
		dyns.forEach(function(dyn){ if (dyn.uses_var(v)) dyn.update_ref(); });
		return value;
	};





	// Fireball

	var templates = {}, mapping = {}, calculated_fields = {}, latest = {};
	var show_when = {}, on_click = {}, on_submit = {}, on_change = {}, on_update = {};
	var live_fns = {}, filter_fns = {};

	function matches(element, selector){
		if (!element || element.nodeType !== 1) return false;
	    var m = element.webkitMatchesSelector || element.mozMatchesSelector ||
	            element.oMatchesSelector || element.matchesSelector || element.matches;
	    return m.call(element, selector);
	}

	function closest(node, sel){
	    while (node && !(matches(node, sel))) node = node.parentNode;
	    if (matches(node, sel)) return node;
	}

	function get_field_value(domid, json, path){
		if (json[path]) return json[path];
		var key = domid + " " + path;
		if (calculated_fields[key]) return calculated_fields[key](json);
		return null;
	}

	function decorate_element(el, json, domid){
		var directive = el.getAttribute('data-set');
		if (!directive) return;
		var maps = directive.split(' ');
		maps.forEach(function(word){
   		var parts = word.split(':');
   		var attr, path;
   		if (parts.length == 1){
   		   attr = path = parts[0];
   		} else if (parts.length == 2){
   		   attr = parts[0];
   		   path = parts[1];
   		} else if (parts.length == 3){
   		   attr = parts[0];
   		   if (parts[1] != domid) return;
   		   path = parts[2];
   		}
		   var val = get_field_value(domid, json, path);
		   if (attr == 'text'){
			   el.innerHTML = val;
		   } else if (attr == 'value') {
            el.value = val;
		   } else {
			   el.setAttribute(attr, val);
   		}				
		});
	}

	function project(json, dom, domid){
		if (!json) json = {};
		if (typeof json === 'string' || typeof json === 'number'){
		// if (!hasChildElements(dom)){
			dom.innerHTML = json;
			return dom;
		}
		// if (json.id) dom.id = json.id;

		decorate_element(dom, json, domid);
		var matches = dom.querySelectorAll('[data-set]');
		for (var i = 0; i < matches.length; i++) {
		  var el = matches[i];
	          decorate_element(el, json, domid);
		}

		return dom;
	}

	function projectAll(array, dom, domid, path){
		var doms = [];
		for (var k in array){
			var o = array[k];
			if (!o.id) o.id = k;
			var clone = dom.cloneNode(true);
			clone.data = o;
			if (path) clone.path = path + '/' + o.id;
			clone.id = o.id;
			doms.push(project(o, clone, domid));
		}
		return doms;
	}


	function projectOnto(domid, path){
		var value = latest[domid];
		if (filter_fns[domid]) value = filter_fns[domid](value);
		if (domid.match(/\.\.\.$/)){
			var domid2 = domid.slice(0,-3);
			var outer = document.querySelector(domid2);
			if (!outer) return alert("Not found in DOM: " + domid2);
			if (!templates[domid]){
				// cache template
				templates[domid] = outer.firstElementChild.cloneNode(true);
			}
			outer.innerHTML = "";
			if (!value) return;
			var dom_objs = projectAll(value, templates[domid], domid2, path);
			dom_objs.forEach(function(dom){ outer.appendChild(dom); });
		} else {
			var el = document.querySelector(domid);
			project(value, el, domid);
		}
		if (on_update[domid]) on_update[domid](value);
		// refresh();
	}



	function map_to_dom(fbref, domid, path){
		if (!path) {
			for (var k in domid) map_to_dom(fbref, k, domid[k]);
			return;
		}

		if (typeof path == 'function'){
			live_fns[domid] = path;
			return;
		}

		if (typeof path == 'object'){
			filter_fns[domid] = path[1];
			path = path[0];
		}

		var dyn = fbref.dynamic(path);
		mapping[simpleSelector(domid)] = dyn;

		dyn.on('value', function(snap){
			var o = snap.val();
			latest[domid] = o;
			projectOnto(domid, path);
		});
	}

	function simpleSelector(sel){
		if (sel.match(/\.\.\.$/)) return sel.slice(0,-3);
		return sel;
	}

	function refresh(obj){
		if (obj) return projectOnto(obj);
		for (var k in show_when){
			var nodes = document.querySelectorAll(k);
			for (var i = 0; i < nodes.length; i++) {
				var el = nodes[i];
				if (show_when[k](el)) el.style.display = '';
				else el.style.display = 'none';
			};
		}
		for (var k in live_fns){
			var nodes = document.querySelectorAll(simpleSelector(k));
			for (var i = 0; i < nodes.length; i++) {
				var el = nodes[i];
				live_fns[k](function(value){ latest[k] = value; projectOnto(k); });
			}
		}
	}

	document.addEventListener('DOMContentLoaded', function(){
		refresh();
		var hasTouch = ('ontouchstart' in window);
		if (hasTouch) document.addEventListener('click', function(ev){
			ev.stopPropagation();
			ev.preventDefault();
			return false;
		});
		document.addEventListener('click', function(ev){
			for (var k in on_click){
				var el = closest(ev.target, k);
				if (el){
					on_click[k](el, ev);
					refresh();
                    ev.stopPropagation();
					ev.preventDefault();
					return false;
				}
			}
		});

		document.addEventListener('submit', function(ev){
			for (var k in on_submit){
				var el = closest(ev.target, k);
				if (el){
					on_submit[k](el);
					refresh();
					ev.stopPropagation();
					ev.preventDefault();
					return false;
				}
			}
		});
		
		document.addEventListener('change', function(ev){
			for (var k in on_change){
				var el = closest(ev.target, k);
				if (el){
					on_change[k](el);
					ev.preventDefault();
					refresh();
					return false;
				}
			}
		});
	});

	function extend(obj, props){
		for (var k in props){ obj[k] = props[k]; }
	}

	var firebases = {};

	window.Fireball = function(F, obj){
		if (!obj) return mapping[F] && mapping[F].live_ref;
		if (typeof F == "string") {
			if (!firebases[F]) firebases[F] = new Firebase(F);
			F = firebases[F];
		}
		window.Fireball.set = function(x,y){ return F.param(x,y); };
		window.Fireball.get = function(x){ return F.param(x); };
		if (obj.map) map_to_dom(F, obj.map);
		if (obj.on_update) extend(on_update, obj.on_update);
		if (obj.on_click) extend(on_click, obj.on_click);
		if (obj.on_submit) extend(on_submit, obj.on_submit);
		if (obj.on_change) extend(on_change, obj.on_change);
		if (obj.show_when) extend(show_when, obj.show_when);
		if (obj.calculated_fields) extend(calculated_fields, obj.calculated_fields);
		if (obj.init) obj.init();
		refresh();
	};

	window.Fireball.refresh = refresh;
	window.Fireball.latest = function(domid){ return latest[domid]; };

	var copy = {};
	window.Fireball.changed = function(p){
		if (copy[p] == window[p]) return false;
		copy[p] = window[p];
		return true;	
	};
})();
