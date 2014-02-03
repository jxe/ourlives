function values(obj){
	return Object.keys(obj).map(function(x){ obj[x].id = x; return obj[x]; });
}


var width = 960,
    height = 300;

var svg = d3.select("svg").attr("width", width).attr("height", height);



var force = d3.layout.force()
    .gravity(.06)
    .distance(50)
    .charge(-100)
    .size([width, height]);

var nodes = [], links = [], nodes_by_id = {}, links_by_id = {};
var link = svg.selectAll("path").data(links, function(l){ return l&&l.id; });
var node = svg.selectAll("g").data(nodes, function(l){ return l&&l.id; });
force.nodes(nodes).links(links);


force.on("tick", function() {
  // draw directed edges with proper padding from node centers
  svg.selectAll("path.link").attr('d', function(d) {
  	if (!d || !d.target || !d.source || !d.source.x || !d.target.x) return 'M0,0L100,100';
    var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,
        sourcePadding = 8,
        targetPadding = 11,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
    return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });

  svg.selectAll("g").attr("transform", function(d) { if (d) return "translate(" + d.x + "," + d.y + ")"; });
});


F.child('activities').on('value', function(snap) {
	var got_nodes = snap.val();
	for (var node_id in got_nodes){
		var n = got_nodes[node_id];
		if (!nodes_by_id[node_id]){
			n.id = node_id;
			nodes.push(n);
			nodes_by_id[node_id] = n;
		}
	}

	for (var node_id in got_nodes){
		var n = got_nodes[node_id];
		if (n.better_than){
			Object.keys(n.better_than).forEach(function(better_node_id){
				var link_id = (n.id + "::" + better_node_id);
				if (!links_by_id[link_id] && nodes_by_id[better_node_id]){
					links_by_id[link_id] = { id: link_id, target: n, source: nodes_by_id[better_node_id] };
					links.push(links_by_id[link_id]);
				}
			});
		}
	}

    link.data(links, function(l){ return l.id; })
      .enter().append("path")
        .attr("class", "link");
  
    var new_node = node.data(nodes, function(n){ return n.id; })
      .enter().append("g")
        .attr("class", "node")
        .call(force.drag);
  
    new_node.append("circle")
        .attr("x", 0)
        .attr("y", 0)
        .attr("r", 8)
  
    new_node.append("text")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .text(function(d) { return d.name });

    force.start();
});
