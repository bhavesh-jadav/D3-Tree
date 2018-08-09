import { SVGUtils } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { select, event } from 'd3-selection';
import { tree, hierarchy, cluster } from 'd3-hierarchy';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { max } from 'd3-array';
import * as d3_ease from 'd3-ease';
import 'd3-transition';
//svgutils
var Translate = SVGUtils.Translate;
var D3Tree = /** @class */ (function () {
    /**
     *
     * @param rootSVG Root SVG element where tree will be created
     * @param data JSON Data in form of tree structure
     * @param treeProperties TreeProperties object that specifies different properties and settings of the tree.
     */
    function D3Tree(rootSVG, data, treeProperties) {
        this.rootSVG = rootSVG;
        this.data = data;
        this.treeProperties = treeProperties;
        this.dynamicHeightAndWidth = false; // enable zoom when there is no treeheight and width is provided.
        // animation constants
        this.nodeAnimationDuration = 1000;
        this.nodeLinkAnimationDuration = 1000;
    }
    /**
     * Call this funtion wich will create initial tree structure based on generalProperties specified in
     * treeProperties in constructor
     */
    D3Tree.prototype.CreateTree = function () {
        var generalProperties = this.treeProperties.generalProperties;
        var nodeShapeProperties = this.treeProperties.nodeShapeProperties;
        // set maxExpandedDepth to defaultMaxDepth
        this.maxExpandedDepth = generalProperties.defaultMaxDepth;
        // Generate hierarchy data which gives depth, height and other info.
        this.hierarchyData = hierarchy(this.data, function (d) {
            return d.children;
        });
        /**
         * Recursive funtion used to collapse tree nodes based on defaultMaxDepth property of generalSettings.
         * @param node tree node
         */
        var collapseNodes = function (node) {
            if (node.children && node.depth >= generalProperties.defaultMaxDepth) {
                node._children = node.children;
                node._children.forEach(collapseNodes);
                node.children = null;
            }
        };
        this.hierarchyData.each(collapseNodes); // collapse tree nodes based on DefaultMaxDepth
        // add parent group for tree to rootSVG element.
        this.treeGroup = this.rootSVG
            .append('g')
            .classed('treeGroup', true);
        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.treeHeight == undefined && generalProperties.treeWidth == undefined) {
            this.dynamicHeightAndWidth = true;
        }
        else {
            generalProperties.treeHeight = generalProperties.treeHeight - nodeShapeProperties.size * 4;
            generalProperties.treeWidth = generalProperties.treeWidth - nodeShapeProperties.size * 4;
            this.treeGroup.attr('transform', Translate(nodeShapeProperties.size * 2, nodeShapeProperties.size * 2));
        }
        // create tree data based on give data
        // this._createTreeData();
        this._updateTree();
    };
    /**
     * Updates the tree such as updating nodes, nodes shapes, node links etc.
     */
    D3Tree.prototype._updateTree = function () {
        this._createTreeData();
        this._createNodes();
        this._createNodeLinks();
        // this._createNodeText();
    };
    /**
     * Creates D3 tree data based on json data provided in constructor
     */
    D3Tree.prototype._createTreeData = function () {
        var _this = this;
        var generalProperties = this.treeProperties.generalProperties;
        // if zoom is enabled that means no treeheight or treewidth is provided
        // than we calculate it according to the tree data.
        if (this.dynamicHeightAndWidth) {
            // Find depth wise max children count to calculate proper tree height.
            // base code credit: http://bl.ocks.org/robschmuecker/7880033
            var depthWiseChildrenCount_1 = [1];
            var countDepthwiseChildren_1 = function (level, node) {
                if (node.children && node.children.length > 0 && level < _this.maxExpandedDepth) {
                    if (depthWiseChildrenCount_1.length <= level + 1)
                        depthWiseChildrenCount_1.push(0);
                    depthWiseChildrenCount_1[level + 1] += node.children.length;
                    node.children.forEach(function (d) {
                        countDepthwiseChildren_1(level + 1, d);
                    });
                }
            };
            countDepthwiseChildren_1(0, this.hierarchyData);
            // Find longest text present in tree calculate proper spacing between nodes.
            var maxTextLabelLength_1 = 0;
            var findMaxLabelLength_1 = function (level, node) {
                if (node.children && node.children.length > 0 && level < _this.maxExpandedDepth) {
                    if (level < generalProperties.defaultMaxDepth) {
                        node.children.forEach(function (element) {
                            findMaxLabelLength_1(level + 1, element);
                        });
                    }
                }
                maxTextLabelLength_1 = Math.max(node.data.name.length, maxTextLabelLength_1);
            };
            findMaxLabelLength_1(0, this.hierarchyData);
            var treeHeight = max(depthWiseChildrenCount_1) * 35;
            //TODO: change tree width based on actual width in px of label with max length.
            var treeWidth = maxTextLabelLength_1 * depthWiseChildrenCount_1.length * 10;
            // create tree data with calculated height and width
            generalProperties.treeHeight = treeHeight;
            generalProperties.treeWidth = treeWidth;
            // adding zoom to tree.
            var minZoomScale = Math.min(generalProperties.containerHeight / generalProperties.treeHeight, generalProperties.containerWidth / generalProperties.treeWidth);
            minZoomScale = minZoomScale - (minZoomScale * 0.05);
            // zoom will chnage transform of group element which is child of root SVG and parent of tree
            var treeGroupZoomAction = function () {
                _this.treeGroup.attr('transform', event.transform);
            };
            // settings max translate extent for zooming
            var maxTranslateX = generalProperties.containerWidth - (generalProperties.treeWidth * minZoomScale);
            var maxTranslateY = generalProperties.containerHeight - (generalProperties.treeHeight * minZoomScale);
            // listner will be attached to root SVG.
            this.rootSVGZoomListner = zoom().scaleExtent([minZoomScale, 3])
                // .translateExtent([[0, 0], [generalProperties.containerWidth, generalProperties.containerHeight]])
                .on('zoom', treeGroupZoomAction)
                .filter(function () {
                return (event.button == 1 ||
                    event instanceof WheelEvent);
            });
            // this.treeGroup.attr('transform', 'scale(' + minZoomScale + ')');
            // this.rootSVG.transition().duration(1000).call(this.rootSVGZoomListner.transform as any, zoomIdentity.scale(minZoomScale));
            this.rootSVG.call(this.rootSVGZoomListner);
        }
        if (generalProperties.isClusterLayout) {
            this.treeMap = cluster().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        }
        else {
            this.treeMap = tree().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        }
        // get final data
        this.treeData = this.treeMap(this.hierarchyData);
        this.treeDataArray = this.treeData.descendants();
        this.treeDataLinks = this.treeData.links();
        // console.log(generalProperties.treeHeight, generalProperties.treeWidth);
    };
    D3Tree.prototype._createNodes = function () {
        var _this = this;
        var generalProperties = this.treeProperties.generalProperties;
        var nodeShapeProperties = this.treeProperties.nodeShapeProperties;
        var nodeUID = 0; // Used to uniquely identify nodes in tree and it will be used by d3 data joins for enter, update and exit
        var nodes = this.treeGroup.selectAll('g.node')
            .data(this.treeDataArray, function (d) {
            return (d.id || (d.id = ++nodeUID));
        });
        var click = function (node) {
            // collapse
            if (node.children) {
                node._children = node.children;
                node.children = null;
            }
            else { //expand
                node.children = node._children;
                node._children = null;
            }
            if (_this.dynamicHeightAndWidth) {
                // finding maximum expanded depth for dynamic height calculation.
                _this.maxExpandedDepth = max(_this.hierarchyData.leaves().map(function (node) { return node.depth; }));
            }
            _this._updateTree();
            // this._centerNode(node);
        };
        var nodeEnter = nodes.enter()
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
        if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
            nodeEnter.append('circle')
                .attr('r', nodeShapeProperties.size);
        }
        else if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.square) {
            nodeEnter.append('rect')
                .attr('transform', function (d) {
                var diff = 0 - nodeShapeProperties.size / 2;
                return Translate(diff, diff);
            })
                .attr('height', nodeShapeProperties.size)
                .attr('width', nodeShapeProperties.size);
        }
        nodeEnter.attr('fill', function (d) {
            return d._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
        })
            .attr('stroke', nodeShapeProperties.stroke)
            .attr('stroke-width', nodeShapeProperties.strokeWidth)
            .on('click', click);
        nodeEnter.append('title')
            .text(function (d) {
            return d.data.name;
        });
        if (nodeShapeProperties.animation) {
            nodeEnter.attr('opacity', 0)
                .transition()
                .duration(this.nodeAnimationDuration)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 1);
            nodes.transition()
                .duration(this.nodeAnimationDuration)
                .attr('transform', function (d) {
                if (generalProperties.orientaion == TreeOrientation.horizontal) {
                    return Translate(d.y, d.x);
                }
                else {
                    return Translate(d.x, d.y);
                }
            })
                .attr('fill', function (d) {
                return d._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
            });
            nodes.exit()
                .attr('opacity', 1)
                .transition()
                .duration(this.nodeAnimationDuration)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 0)
                .remove();
        }
        else {
            nodeEnter.attr('opacity', 1);
            nodes.attr('transform', function (d) {
                if (generalProperties.orientaion == TreeOrientation.horizontal) {
                    return Translate(d.y, d.x);
                }
                else {
                    return Translate(d.x, d.y);
                }
            });
            nodes.exit().remove();
        }
    };
    D3Tree.prototype._centerNode = function (node) {
        var t = zoomTransform(this.rootSVG.node());
        var x = -node.y;
        var y = -node.x;
        console.log(node);
        console.log(x, y, t.k);
        x = x * t.k + this.treeProperties.generalProperties.containerWidth / 2;
        y = y * t.k + this.treeProperties.generalProperties.containerHeight / 2;
        console.log(x, y, t.k);
        this.rootSVG.transition().duration(1000).call(this.rootSVGZoomListner.transform, zoomIdentity.translate(x, y).scale(t.k));
    };
    D3Tree.prototype._createNodeLinks = function () {
        var _this = this;
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
        var createPath = function (d) {
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
        };
        var nodeLinks = this.treeGroup.selectAll('path.link')
            .data(this.treeDataLinks, function (d) {
            return (d.source.data.name + d.target.data.name + d.source.x + d.target.y);
        });
        var nodeLinksEnter = nodeLinks.enter()
            .insert("path", "g") //will insert path before g elements
            .classed('link', true)
            .attr('fill', 'none')
            .attr('stroke', nodeLinkProperties.stroke)
            .attr('stroke-width', nodeLinkProperties.strokeWidth)
            .attr('d', createPath);
        nodeLinksEnter.append('title')
            .text(function (d) {
            return d.source.data.name + " -> " + d.target.data.name;
        });
        if (nodeLinkProperties.animation) {
            nodeLinksEnter.each(function (d, i, elements) {
                var linkLength = elements[i].getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", linkLength)
                    .transition()
                    .delay(_this.nodeAnimationDuration - (_this.nodeAnimationDuration / 3))
                    .duration(_this.nodeLinkAnimationDuration)
                    // .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", 0);
            });
            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .transition()
                .duration(this.nodeLinkAnimationDuration)
                .attr('d', createPath);
            nodeLinks.exit()
                .each(function (d, i, elements) {
                var linkLength = elements[i].getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", 0)
                    .attr('opacity', 1)
                    .transition()
                    .duration(_this.nodeLinkAnimationDuration)
                    // .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", linkLength)
                    .attr('opacity', 0)
                    .remove();
            });
        }
        else {
            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .attr('d', createPath);
            nodeLinks.exit().remove();
        }
    };
    D3Tree.prototype._createNodeText = function () {
        var generalProperties = this.treeProperties.generalProperties;
        if (generalProperties.orientaion == TreeOrientation.vertical) {
            this._createNodeTextForVerticalTree();
        }
        else {
            this._createNodeTextForHorizontalTree();
        }
    };
    D3Tree.prototype._createNodeTextForVerticalTree = function () {
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
    D3Tree.prototype._createNodeTextForHorizontalTree = function () {
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