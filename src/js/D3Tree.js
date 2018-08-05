import { SVGUtils } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { select, event } from 'd3-selection';
import { tree, hierarchy, cluster } from 'd3-hierarchy';
import { zoom } from 'd3-zoom';
import { max } from 'd3-array';
import * as d3_ease from 'd3-ease';
import 'd3-transition';
//svgutils
var Translate = SVGUtils.Translate;
var D3Tree = /** @class */ (function () {
    function D3Tree(rootSVG, data, treeProperties) {
        this.rootSVG = rootSVG;
        this.data = data;
        this.treeProperties = treeProperties;
    }
    D3Tree.prototype.CreateTree = function () {
        var generalProperties = this.treeProperties.generalProperties;
        this.treeGroup = this.rootSVG
            .append('g')
            .classed('treeGroup', true);
        if (generalProperties.treeHeight && generalProperties.treeWidth) {
            this._createTreeData();
        }
        else {
            // if no height and width is provided than we calculate it according to the tree data.
            // create treedata with dummy width and height
            // TODO: Find a better way
            generalProperties.treeHeight = 500;
            generalProperties.treeWidth = 500;
            this._createTreeData();
            var depthWiseChildrenCounts_1 = [];
            var maxTextLabelLength_1 = 0;
            this.treeDataArray.forEach(function (node) {
                if (depthWiseChildrenCounts_1[node.depth] == undefined) {
                    depthWiseChildrenCounts_1.push(0);
                }
                depthWiseChildrenCounts_1[node.depth] += 1;
                maxTextLabelLength_1 = Math.max(maxTextLabelLength_1, node.data.name.length);
            });
            var treeHeight = max(depthWiseChildrenCounts_1) * 35;
            //TODO: change tree width based on actual width in px of label with max length.
            var treeWidth = maxTextLabelLength_1 * depthWiseChildrenCounts_1.length * 10;
            // create tree data with calculated height and width
            generalProperties.treeHeight = treeHeight;
            generalProperties.treeWidth = treeWidth;
            this._createTreeData();
            var minZoomScale = Math.min(generalProperties.containerHeight / treeHeight, generalProperties.containerWidth / treeWidth);
            // console.log(minZoomScale);
            // console.log(treeGeneralProperties.containerHeight, treeHeight);
            // console.log(treeGeneralProperties.containerWidth, treeWidth);
            // zoom will chnage transform of group element which is child of root SVG and parent of tree
            var treeGroupZoomAction = function (d, i, elements) {
                select(elements[i]).select('.treeGroup').attr('transform', event.transform);
            };
            // listner will be attached to root SVG
            var rootSVGZoomHandler = zoom().scaleExtent([minZoomScale - (minZoomScale * 0.05), 3])
                .on('zoom', treeGroupZoomAction)
                .filter(function () {
                return (event.button == 1 ||
                    event instanceof WheelEvent);
            });
            this.rootSVG.call(rootSVGZoomHandler);
        }
        this._updateTree();
    };
    D3Tree.prototype._updateTree = function () {
        this._createTreeStructure();
        this._createTreeStructure();
        this._createNodeShape();
        this._createNodeLinks();
        this._createNodeText();
    };
    D3Tree.prototype._createTreeData = function () {
        var generalProperties = this.treeProperties.generalProperties;
        if (generalProperties.isClusterLayout) {
            this.treeMap = cluster().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        }
        else {
            this.treeMap = tree().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        }
        var hierarchyData = hierarchy(this.data, function (d) {
            return d.children;
        });
        var collapseNodes = function (d) {
            if (d.children && d.depth >= generalProperties.defaultMaxDepth - 1) {
                d._children = d.children;
                d._children.forEach(collapseNodes);
                d.children = null;
            }
        };
        hierarchyData.each(collapseNodes);
        this.treeData = this.treeMap(hierarchyData);
        this.treeDataArray = this.treeData.descendants();
        this.treeDataLinks = this.treeData.links();
    };
    D3Tree.prototype._createTreeStructure = function () {
        var generalProperties = this.treeProperties.generalProperties;
        var i = 0;
        var node = this.treeGroup.selectAll('g.node')
            .data(this.treeDataArray, function (d) {
            return (d.id || (d.id = ++i));
        });
        var nodeEnter = node.enter()
            .append('g')
            .classed('node', true)
            .attr('transform', function (d) {
            if (generalProperties.orientaion == TreeOrientation.horizontal) {
                return Translate(d.y, d.x);
            }
            else {
                return Translate(d.x, d.y);
            }
        });
        console.log(node);
        console.log(nodeEnter);
        var nodeUpdate = nodeEnter.merge(node);
        var nodeExit = node.exit().remove();
        console.log(nodeExit);
    };
    D3Tree.prototype._createNodeShape = function () {
        var _this = this;
        var nodeShapeProperties = this.treeProperties.nodeShapeProperties;
        var nodeEnter;
        nodeEnter = this.treeGroup.selectAll('g.node');
        if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
            nodeEnter.append('circle')
                .attr('r', nodeShapeProperties.size)
                .attr('fill', nodeShapeProperties.fill)
                .attr('stroke', nodeShapeProperties.stroke);
        }
        else if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.square) {
            nodeEnter.append('rect')
                .attr('transform', function (d) {
                var diff = 0 - nodeShapeProperties.size / 2;
                return Translate(diff, diff);
            })
                .attr('height', nodeShapeProperties.size)
                .attr('width', nodeShapeProperties.size)
                .attr('fill', nodeShapeProperties.fill)
                .attr('stroke', nodeShapeProperties.stroke);
        }
        var click = function (d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            }
            else {
                d.children = d._children;
                d._children = null;
            }
            _this._updateTree();
        };
        nodeEnter.on('click', click);
        if (nodeShapeProperties.animation) {
            nodeEnter.attr('opacity', 0)
                .transition()
                .duration(1500)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 1);
        }
        nodeEnter.append('title')
            .text(function (d) {
            return d.data.name;
        });
        this._updateTreeGroupTransform(nodeShapeProperties.size + 5, 0);
    };
    D3Tree.prototype._createNodeLinks = function () {
        var nodeLinkProperties = this.treeProperties.nodeLinkProperties;
        var generalProperties = this.treeProperties.generalProperties;
        var horizontalCurveLink = linkHorizontal()
            .x(function (d) { return d.y; })
            .y(function (d) { return d.x; });
        var verticalCurveLink = linkVertical()
            .x(function (d) { return d.x; })
            .y(function (d) { return d.y; });
        var horizontalStraightLink = function (source, target) {
            return "M" + source.y + "," + source.x +
                "L" + target.y + "," + target.x;
        };
        var verticalStraightLink = function (source, target) {
            return "M" + source.x + "," + source.y +
                "L" + target.x + "," + target.y;
        };
        var horizontalSquareLink = function (source, target) {
            return "M" + source.y + "," + source.x +
                "H" + (source.y + 15) + // change +15
                "V" + target.x +
                "H" + target.y;
        };
        var verticalSquareLink = function (source, target) {
            return "M" + source.x + "," + source.y +
                "H" + target.x +
                "V" + target.y;
        };
        var links = this.treeGroup.selectAll('path.link')
            .data(this.treeDataLinks)
            .enter()
            .insert("g", "g") //will insert path before g elements
            .classed('link', true);
        links.append('path')
            .attr('fill', 'none')
            .attr('stroke', nodeLinkProperties.stroke)
            .attr('stroke-width', nodeLinkProperties.strokeWidth)
            .attr('d', function (d) {
            if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.curved) {
                if (generalProperties.orientaion == TreeOrientation.horizontal) {
                    return horizontalCurveLink(d);
                }
                else {
                    return verticalCurveLink(d);
                }
            }
            else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.straight) {
                if (generalProperties.orientaion == TreeOrientation.horizontal) {
                    return horizontalStraightLink(d.source, d.target);
                }
                else {
                    return verticalStraightLink(d.source, d.target);
                }
            }
            else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.corner) {
                if (generalProperties.orientaion == TreeOrientation.horizontal) {
                    return horizontalSquareLink(d.source, d.target);
                }
                else {
                    return verticalSquareLink(d.source, d.target);
                }
            }
        });
        if (nodeLinkProperties.animation) {
            links.selectAll('path').each(function (d, i, elements) {
                var linkLength = elements[i].getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", linkLength)
                    .transition()
                    .duration(1000)
                    .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", 0);
            });
        }
        links.append('title')
            .text(function (d) {
            return d.source.data.name + " -> " + d.target.data.name;
        });
    };
    D3Tree.prototype._createNodeText = function () {
        var generalProperties = this.treeProperties.generalProperties;
        if (generalProperties.orientaion == TreeOrientation.vertical) {
            this._createNodeTextVertical();
        }
        else {
            this._createNodeTextHorizontal();
        }
    };
    D3Tree.prototype._createNodeTextVertical = function () {
        var nodeShapeProperties = this.treeProperties.nodeShapeProperties;
        var nodeTextProperties = this.treeProperties.nodeTextProperties;
        var nodeTexts = this.treeGroup.selectAll('text.nodeText')
            .data(this.treeDataArray)
            .enter()
            .append('g')
            .attr('transform', function (d) {
            return Translate(d.x + nodeShapeProperties.size + 8, d.y);
        });
        nodeTexts.append('text')
            .attr('fill', nodeTextProperties.foregroundColor)
            .style('dominant-baseline', 'central')
            .text(function (d) {
            return d.data.name;
        });
        nodeTexts.style('text-anchor', function (d, i, elements) {
            var textWidth = elements[i].getBBox().width;
            var textAnchor = (textWidth < nodeShapeProperties.size) ? 'middle' : 'start';
            return textAnchor;
        });
        nodeTexts.append('title')
            .text(function (d) {
            return d.data.name;
        });
        if (nodeTextProperties.enableBackground) {
            nodeTexts.insert('rect', 'text')
                .each(function (d, i, elements) {
                var svgRect = elements[i].parentNode.getBBox();
                select(elements[i])
                    .attr('x', svgRect.x - 2)
                    .attr('y', svgRect.y - 2)
                    .attr('height', svgRect.height + 4)
                    .attr('width', svgRect.width + 4)
                    .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
            });
        }
    };
    D3Tree.prototype._createNodeTextHorizontal = function () {
        var nodeShapeProperties = this.treeProperties.nodeShapeProperties;
        var nodeTextProperties = this.treeProperties.nodeTextProperties;
        var nodeTexts = this.treeGroup.selectAll('text.nodeText')
            .data(this.treeDataArray)
            .enter()
            .append('g')
            .attr('transform', function (d) {
            var translate = d.children ? Translate(d.y - nodeShapeProperties.size - 8, d.x) :
                Translate(d.y + nodeShapeProperties.size + 8, d.x);
            return translate;
        });
        nodeTexts.append('text')
            .attr('fill', nodeTextProperties.foregroundColor)
            .style('dominant-baseline', 'central')
            .text(function (d) {
            return d.data.name;
        });
        nodeTexts.style('text-anchor', function (d, i, elements) {
            var textAnchor = d.children ? 'end' : 'start';
            return textAnchor;
        });
        nodeTexts.append('title')
            .text(function (d) {
            return d.data.name;
        });
        if (nodeTextProperties.enableBackground) {
            nodeTexts.insert('rect', 'text')
                .each(function (d, i, elements) {
                var svgRect = elements[i].parentNode.getBBox();
                select(elements[i])
                    .attr('x', svgRect.x - 2)
                    .attr('y', svgRect.y - 2)
                    .attr('height', svgRect.height + 4)
                    .attr('width', svgRect.width + 4)
                    .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
            });
        }
    };
    D3Tree.prototype._updateRootSVGSize = function (height, width) {
        this.rootSVG.style('height', height + "px")
            .style('width', width + "px");
    };
    D3Tree.prototype._updateTreeGroupTransform = function (x, y) {
        this.treeGroup.attr('transform', Translate(x, y));
    };
    return D3Tree;
}());
export { D3Tree };
//enums
export var TreeNodeShapeTypes;
(function (TreeNodeShapeTypes) {
    TreeNodeShapeTypes["circle"] = "circle";
    TreeNodeShapeTypes["square"] = "square";
})(TreeNodeShapeTypes || (TreeNodeShapeTypes = {}));
export var TreeNodeLinkTypes;
(function (TreeNodeLinkTypes) {
    TreeNodeLinkTypes["straight"] = "straight";
    TreeNodeLinkTypes["curved"] = "curved";
    TreeNodeLinkTypes["corner"] = "corner";
})(TreeNodeLinkTypes || (TreeNodeLinkTypes = {}));
export var TreeOrientation;
(function (TreeOrientation) {
    TreeOrientation["horizontal"] = "horizontal";
    TreeOrientation["vertical"] = "vertical";
})(TreeOrientation || (TreeOrientation = {}));
//# sourceMappingURL=D3Tree.js.map