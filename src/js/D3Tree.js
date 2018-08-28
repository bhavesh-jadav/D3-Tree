import { ShapeType, Orientation, LineType, Position } from './D3TreeInterfaces';
import { tree, hierarchy, cluster } from 'd3-hierarchy';
import { SVGUtils } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { select, event } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { max } from 'd3-array';
import 'd3-transition';
//svgutils
var Translate = SVGUtils.Translate;
var MeasureTextSize = SVGUtils.MeasureTextSize;
var GetTailoredTextOrDefault = SVGUtils.GetTailoredTextOrDefault;
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
        this.nodeUID = 0; // Used to uniquely identify nodes in tree and it will be used by d3 data joins for enter, update and exit
        this._setDefaultValuesForTreeProperties();
    }
    /**
     * Call this funtion which will create initial tree structure based on `generalProperties` specified in
     * `treeProperties` in constructor.
     */
    D3Tree.prototype.CreateTree = function () {
        var generalProperties = this.treeProperties.generalProperties;
        var nodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        var nodeTextProperties = this.treeProperties.nodeProperties.textProperties;
        // set maxExpandedDepth to defaultMaxDepth
        this.maxExpandedDepth = generalProperties.defaultMaxDepth;
        // Generate hierarchy data which gives depth, height and other info.
        this.hierarchyData = hierarchy(this.data, function (treeDatum) {
            return treeDatum.children;
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
        // calculate node size i.e. acutal height and width for spacing purpose.
        if (nodeShapeProperties.shapeType == ShapeType.circle) {
            this.nodeShapeHeight = this.nodeShapeWidth = 2 * nodeShapeProperties.circleRadius;
        }
        else if (nodeShapeProperties.shapeType == ShapeType.rect) {
            this.nodeShapeHeight = nodeShapeProperties.rectHeight;
            this.nodeShapeWidth = nodeShapeProperties.rectWidth;
        }
        // if text needs to be shown inside the shape then we set `maxAllowedWidth` of text properties to size of node
        if (nodeTextProperties.showTextInsideShape) {
            nodeTextProperties.maxAllowedWidth = this.nodeShapeWidth;
        }
        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.enableZoom) {
            this.dynamicHeightAndWidth = true;
            // this.rootSVG.style('cursor', 'grab')
        }
        this._updateTree(); // update the tree if already created or make a new tree.
        if (this.dynamicHeightAndWidth) {
            this._centerNode(this.treeNodes); // center the root node.
        }
    };
    /**
     * Updates the tree such as updating nodes, nodes shapes, node links etc. based on user interaction.
     */
    D3Tree.prototype._updateTree = function () {
        this._createTreeData();
        this._createNodeGroups();
        this._createNodeShapes();
        this._createNodeLinks();
        this._createNodeText();
    };
    D3Tree.prototype._setDefaultValuesForTreeProperties = function () {
        var generalProperties = this.treeProperties.generalProperties;
        var nodeProperties = this.treeProperties.nodeProperties;
        var nodeShapeProperties = nodeProperties.shapeProperties;
        var nodeTextProperties = nodeProperties.textProperties;
        var nodeImageProperties = nodeProperties.imageProperties;
        var treeLinkProperties = this.treeProperties.linkProperties;
        // general properties
        if (generalProperties.isClusterLayout == undefined) {
            generalProperties.isClusterLayout = false;
        }
        if (generalProperties.extraPerLevelDepth == undefined) {
            generalProperties.extraPerLevelDepth = 0;
        }
        if (generalProperties.minZoomScale == undefined) {
            generalProperties.minZoomScale = 0.2;
        }
        if (generalProperties.maxZoomScale == undefined) {
            generalProperties.minZoomScale = 3;
        }
        if (generalProperties.extraSpaceBetweenNodes == undefined) {
            generalProperties.extraSpaceBetweenNodes = 0;
        }
        // node properties
        if (nodeProperties.animationDuration == undefined) {
            nodeProperties.animationDuration = 1000;
        }
        // node shape properties
        if (nodeShapeProperties.takeColorsFromData == undefined) {
            nodeShapeProperties.takeColorsFromData = false;
        }
        // node text properties
        if (nodeTextProperties.backgroundColor == undefined) {
            nodeTextProperties.backgroundColor = '#F2F2F2';
        }
        if (nodeTextProperties.fontWeight == undefined) {
            nodeTextProperties.fontWeight = 'normal';
        }
        if (nodeTextProperties.fontStyle == undefined) {
            nodeTextProperties.fontStyle = 'normal';
        }
        if (nodeTextProperties.spaceBetweenNodeAndText == undefined) {
            nodeTextProperties.spaceBetweenNodeAndText = 5;
        }
        if (nodeTextProperties.maxAllowedWidth == undefined) {
            nodeTextProperties.maxAllowedWidth = 50;
        }
        if (nodeTextProperties.showTextInsideShape == undefined) {
            nodeTextProperties.showTextInsideShape = false;
        }
        if (nodeTextProperties.textPadding == undefined || !nodeTextProperties.showBackground) {
            if (nodeTextProperties.showBackground || nodeTextProperties.showTextInsideShape) {
                nodeTextProperties.textPadding = 4;
            }
            else {
                nodeTextProperties.textPadding = 0;
            }
        }
        if (nodeTextProperties.takeColorsFromData == undefined) {
            nodeTextProperties.takeColorsFromData = false;
        }
        // node image properties
        if (nodeImageProperties.defaultImageURL == undefined) {
            nodeImageProperties.defaultImageURL = 'https://i.stack.imgur.com/KIqMD.png';
        }
        if (nodeImageProperties.height == undefined || nodeImageProperties.width == undefined) {
            nodeImageProperties.height = nodeImageProperties.width = 30;
        }
        if (nodeImageProperties.strokeColor == undefined) {
            nodeImageProperties.strokeColor = 'none';
        }
        if (nodeImageProperties.strokeWidth == undefined) {
            nodeImageProperties.strokeWidth = 0;
        }
        if (nodeImageProperties.shape == undefined) {
            nodeImageProperties.shape = ShapeType.none;
        }
        if (nodeImageProperties.position == undefined) {
            nodeImageProperties.position = Position.left;
        }
        if (nodeImageProperties.xOffset == undefined) {
            nodeImageProperties.xOffset = 0;
        }
        if (nodeImageProperties.yOffset == undefined) {
            nodeImageProperties.yOffset = 0;
        }
        // node link properties
        if (treeLinkProperties.animationDuration == undefined) {
            treeLinkProperties.animationDuration = 1000;
        }
        if (treeLinkProperties.takeColorsFromData == undefined) {
            treeLinkProperties.takeColorsFromData = false;
        }
    };
    /**
     * Creates D3 tree data based on json tree data provided in constructor
     */
    D3Tree.prototype._createTreeData = function () {
        var _this = this;
        var generalProperties = this.treeProperties.generalProperties;
        var nodeTextProperties = this.treeProperties.nodeProperties.textProperties;
        // if dynaimicHeightSndWidth is true,s that means no treeheight or treewidth is provided
        // than we calculate it according to the tree data.
        var treeHeight;
        var treeWidth;
        var textProperties = {
            'fontFamily': nodeTextProperties.fontFamily,
            'fontSize': nodeTextProperties.fontSize,
            'fontStyle': nodeTextProperties.fontStyle,
            'fontWeight': nodeTextProperties.fontWeight
        };
        if (this.dynamicHeightAndWidth) {
            // Find longest text width present in tree to calculate proper spacing between nodes.
            if (nodeTextProperties.showTextInsideShape) {
                treeWidth = (this.nodeShapeWidth + generalProperties.extraPerLevelDepth) * (this.maxExpandedDepth + 1);
                if (generalProperties.orientation == Orientation.horizontal) {
                    treeHeight = this.hierarchyData.leaves().length * (this.nodeShapeHeight + generalProperties.extraSpaceBetweenNodes);
                }
                else {
                    treeHeight = this.hierarchyData.leaves().length * (this.nodeShapeWidth + generalProperties.extraSpaceBetweenNodes);
                }
            }
            else {
                var maxTextWidth_1 = 0;
                var findMaxTextLength_1 = function (level, node) {
                    var textWidth = MeasureTextSize(textProperties, node.data.name).width;
                    if (node.children && node.children.length > 0 && level < _this.maxExpandedDepth) {
                        node.children.forEach(function (element) {
                            findMaxTextLength_1(level + 1, element);
                        });
                    }
                    maxTextWidth_1 = Math.max(textWidth, maxTextWidth_1);
                };
                findMaxTextLength_1(0, this.hierarchyData);
                var textHeight = MeasureTextSize(textProperties, this.hierarchyData.data.name).height + nodeTextProperties.textPadding;
                // if node shape size is greater than text height than use that for treeHeight calculation
                var perNodeHeight = textHeight > this.nodeShapeHeight ? textHeight : this.nodeShapeHeight + generalProperties.extraSpaceBetweenNodes;
                var perNodeWidth = 0;
                perNodeWidth = nodeTextProperties.maxAllowedWidth + nodeTextProperties.textPadding * 2;
                treeWidth = (maxTextWidth_1 + generalProperties.extraPerLevelDepth) * (this.maxExpandedDepth + 1);
                if (generalProperties.orientation == Orientation.horizontal) {
                    treeHeight = this.hierarchyData.leaves().length * perNodeHeight;
                }
                else {
                    treeHeight = this.hierarchyData.leaves().length * perNodeWidth;
                }
            }
            // zoom will chnage transform of group element which is child of root SVG and parent of tree
            var treeGroupZoomAction = function () {
                _this.treeGroup.attr('transform', event.transform);
                // this.rootSVG.style('cursor', 'grab');
            };
            // listner will be attached to root SVG.
            this.rootSVGZoomListner = zoom().scaleExtent([generalProperties.minZoomScale, generalProperties.maxZoomScale])
                // .on('start', () => {
                //     console.log('start');
                //     this.rootSVG.style('cursor', 'grabbing');
                // })
                // .on('end', () => {
                //     console.log('end');
                //     this.rootSVG.style('cursor', 'grab');
                // })
                .on('zoom', treeGroupZoomAction)
                .filter(function () {
                return (event.button == 1 ||
                    event instanceof WheelEvent);
            });
            this.rootSVG.call(this.rootSVGZoomListner)
                .on('dblclick.zoom', function () {
                // center to root node on double click.
                _this._centerNode(_this.treeNodes);
            })
                .on('ondragstart', function () {
                _this.rootSVG.style('cursor', 'grabbing');
            });
        }
        else {
            // to set right margin for fixed height and width tree, we do following calculations.
            var fixedMarginForTree = 10;
            var rootNodeTextSize = MeasureTextSize(textProperties, this.hierarchyData.data.name);
            if (generalProperties.orientation == Orientation.horizontal) {
                var maxLeaveNodesTextWidth_1 = 0;
                var rootNodeWidth = 0;
                var fixedNodeWidth = nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeWidth / 2;
                if (nodeTextProperties.showTextInsideShape) {
                    rootNodeWidth = this.nodeShapeWidth / 2;
                }
                else {
                    rootNodeWidth = rootNodeTextSize.width + fixedNodeWidth;
                }
                this.hierarchyData.leaves().forEach(function (node) {
                    var textWidth = MeasureTextSize(textProperties, node.data.name).width;
                    maxLeaveNodesTextWidth_1 = Math.max(textWidth, maxLeaveNodesTextWidth_1);
                });
                if (nodeTextProperties.showTextInsideShape) {
                    treeWidth = generalProperties.containerWidth - this.nodeShapeWidth;
                }
                else {
                    treeWidth = generalProperties.containerWidth - (rootNodeWidth + maxLeaveNodesTextWidth_1 + fixedNodeWidth);
                }
                treeWidth -= fixedMarginForTree * 2;
                treeHeight = generalProperties.containerHeight - fixedMarginForTree * 2;
                this.treeGroup.transition()
                    .duration(1000)
                    .attr('transform', Translate(rootNodeWidth + fixedMarginForTree, fixedMarginForTree));
            }
            else {
                var nodeHeight = 0;
                var fixedNodeHeight = nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeHeight / 2;
                if (nodeTextProperties.showTextInsideShape) {
                    nodeHeight = this.nodeShapeHeight / 2;
                }
                else {
                    nodeHeight = rootNodeTextSize.height + fixedNodeHeight;
                }
                if (nodeTextProperties.showTextInsideShape) {
                    treeWidth = generalProperties.containerHeight - this.nodeShapeHeight;
                }
                else {
                    treeWidth = generalProperties.containerHeight - nodeHeight * 2;
                }
                treeHeight = generalProperties.containerWidth - fixedMarginForTree * 2;
                treeWidth -= fixedMarginForTree * 2;
                this.treeGroup.transition()
                    .duration(1000)
                    .attr('transform', Translate(fixedMarginForTree, fixedMarginForTree + nodeHeight));
            }
        }
        if (generalProperties.isClusterLayout) {
            this.tree = cluster().size([treeHeight, treeWidth]);
        }
        else {
            this.tree = tree().size([treeHeight, treeWidth]);
        }
        // get final data
        this.treeNodes = this.tree(this.hierarchyData);
        this.treeNodeArray = this.treeNodes.descendants();
        // if orientation is horizontal than swap the x and y
        if (generalProperties.orientation == Orientation.horizontal) {
            this.treeNodeArray.forEach(function (node) {
                node.x = node.x + node.y;
                node.y = node.x - node.y;
                node.x = node.x - node.y;
            });
        }
        this.treeDataLinks = this.treeNodes.links();
    };
    /**
     * Updates nodes selection with latest data and adds new node groups into DOM.
     */
    D3Tree.prototype._createNodeGroups = function () {
        var _this = this;
        var nodeProperties = this.treeProperties.nodeProperties;
        var nodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        this.nodes = this.treeGroup.selectAll('g.node')
            .data(this.treeNodeArray, function (node) {
            return (node.id || (node.id = ++_this.nodeUID));
        });
        this.nodesEnter = this.nodes.enter()
            .append('g')
            .classed('node', true)
            .attr('transform', function (node) {
            return Translate(node.x, node.y);
        });
        // animation will be applicable for whole node i.e. shape, text, image etc.
        if (nodeProperties.animation) {
            this.nodesEnter.attr('opacity', 0)
                .transition()
                .duration(nodeProperties.animationDuration)
                // .ease(d3_ease.easeCubicOut)
                .attr('opacity', 1);
            this.nodes.transition()
                .duration(nodeProperties.animationDuration)
                .attr('transform', function (node) {
                return Translate(node.x, node.y);
            });
            this.nodes.select('.node-shape')
                .transition()
                .duration(nodeProperties.animationDuration)
                .attr('fill', function (node) {
                return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
            });
            this.nodes.exit()
                .attr('opacity', 1)
                .transition()
                .duration(nodeProperties.animationDuration)
                // .ease(d3_ease.easeCubicOut)
                .attr('opacity', 0)
                .remove();
        }
        else {
            this.nodesEnter.attr('opacity', 1);
            this.nodes.attr('transform', function (node) {
                return Translate(node.x, node.y);
            });
            this.nodes.select('.node-shape')
                .attr('fill', function (node) {
                return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
            });
            this.nodes.exit().remove();
        }
    };
    D3Tree.prototype._createNodeShapes = function () {
        var _this = this;
        var nodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        var click = function (node) {
            if (node.children) { // collapse
                node._children = node.children;
                node.children = null;
            }
            else if (node._children) { // expand
                node.children = node._children;
                node._children = null;
            }
            if (_this.dynamicHeightAndWidth) {
                // finding maximum expanded depth for dynamic height calculation.
                _this.maxExpandedDepth = max(_this.hierarchyData.leaves().map(function (node) { return node.depth; }));
            }
            _this._updateTree();
            if (_this.dynamicHeightAndWidth) {
                _this._centerNode(node);
            }
        };
        var nodeShape;
        if (nodeShapeProperties.shapeType == ShapeType.circle) {
            nodeShape = this.nodesEnter.append('circle')
                .attr('r', nodeShapeProperties.circleRadius);
        }
        else if (nodeShapeProperties.shapeType == ShapeType.rect) {
            nodeShape = this.nodesEnter.append('rect')
                .attr('x', 0 - nodeShapeProperties.rectWidth / 2)
                .attr('y', 0 - nodeShapeProperties.rectHeight / 2)
                .attr('height', nodeShapeProperties.rectHeight)
                .attr('width', nodeShapeProperties.rectWidth);
        }
        nodeShape.classed('node-shape', true)
            .attr('fill', function (node) {
            return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
        })
            .attr('stroke', nodeShapeProperties.strokeColor)
            .attr('stroke-width', nodeShapeProperties.strokeWidth);
        this.nodesEnter.on('click', click)
            .on('mouseover', function (node, i, elements) {
            if (node.children || node._children) {
                select(elements[i]).style('cursor', 'pointer');
            }
        });
        if (this.treeProperties.nodeProperties.imageProperties.showImage) {
            this._addImageToNode();
        }
        this.nodesEnter.append('title')
            .text(function (node) {
            return node.data.name;
        });
    };
    D3Tree.prototype._addImageToNode = function () {
        var _this = this;
        var nodeImageProperties = this.treeProperties.nodeProperties.imageProperties;
        var nodeImageEnter = this.nodesEnter.append('g')
            .classed('node-image', true);
        var imageX = function () {
            var x = 0;
            var maxAllowedX = 0;
            if (!_this.treeProperties.nodeProperties.textProperties.showTextInsideShape) {
                x = -nodeImageProperties.width / 2;
            }
            else if (nodeImageProperties.position == Position.left) {
                x = -_this.nodeShapeWidth / 2 + nodeImageProperties.xOffset;
                maxAllowedX = nodeImageProperties.width + _this.nodeShapeWidth / 2;
                if (Math.abs(x) > maxAllowedX) {
                    x = -maxAllowedX;
                    // console.log('too much x offest not allowed');
                }
            }
            else if (nodeImageProperties.position == Position.right) {
                x = _this.nodeShapeWidth / 2 - nodeImageProperties.width + nodeImageProperties.xOffset;
                maxAllowedX = _this.nodeShapeWidth / 2;
                if (Math.abs(x) > maxAllowedX) {
                    x = maxAllowedX;
                    // console.log('too much x offest not allowed');
                }
            }
            return x;
        };
        var imageY = function () {
            var y;
            if (nodeImageProperties.position == Position.left || nodeImageProperties.position == Position.right) {
                y = -nodeImageProperties.height / 2;
            }
            return y;
        };
        if (nodeImageProperties.shape == ShapeType.circle) {
            nodeImageEnter.append('circle')
                .attr('r', function () {
                return nodeImageProperties.height / 2;
            })
                .attr('fill', 'none')
                .attr('stroke', nodeImageProperties.strokeColor)
                .attr('stroke-width', nodeImageProperties.strokeWidth)
                .attr('cx', imageX() + nodeImageProperties.width / 2)
                .attr('cy', 0);
        }
        else if (nodeImageProperties.shape == ShapeType.rect) {
            nodeImageEnter.append('rect')
                .attr('height', nodeImageProperties.height)
                .attr('width', nodeImageProperties.width)
                .attr('fill', 'none')
                .attr('stroke', nodeImageProperties.strokeColor)
                .attr('stroke-width', nodeImageProperties.strokeWidth)
                .attr('x', imageX)
                .attr('y', imageY);
        }
        nodeImageEnter.append('image')
            .attr('xlink:href', function (node) {
            if (node.imageURL) {
                return node.imageURL;
            }
            else {
                return nodeImageProperties.defaultImageURL;
            }
        })
            .attr('width', nodeImageProperties.width)
            .attr('height', nodeImageProperties.height)
            .attr('x', imageX)
            .attr('y', imageY);
    };
    // http://bl.ocks.org/robschmuecker/7880033
    D3Tree.prototype._centerNode = function (node) {
        var t = zoomTransform(this.rootSVG.node());
        var x = -node.x;
        var y = -node.y;
        x = x * t.k + this.treeProperties.generalProperties.containerWidth / 2;
        y = y * t.k + this.treeProperties.generalProperties.containerHeight / 2;
        this.rootSVG.transition().duration(1000).call(this.rootSVGZoomListner.transform, zoomIdentity.translate(x, y).scale(t.k));
    };
    D3Tree.prototype._createNodeText = function () {
        var _this = this;
        var generalProperties = this.treeProperties.generalProperties;
        var nodeTextProperties = this.treeProperties.nodeProperties.textProperties;
        var nodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        var nodeImageProperties = this.treeProperties.nodeProperties.imageProperties;
        var textProperties = {
            fontFamily: nodeTextProperties.fontFamily,
            fontSize: nodeTextProperties.fontSize,
            fontStyle: nodeTextProperties.fontStyle,
            fontWeight: nodeTextProperties.fontWeight
        };
        var maxAllowedTextwidth = nodeTextProperties.maxAllowedWidth - nodeTextProperties.textPadding * 2;
        var nodeTextEnter = this.nodesEnter
            .append('g')
            .classed('nodeText', true)
            .each(function (node, i, elements) {
            var nodeTextGroup = select(elements[i]);
            var nodeText = nodeTextGroup.append('text')
                .attr('fill', nodeTextProperties.foregroundColor)
                .style('dominant-baseline', 'middle')
                .style('font-size', nodeTextProperties.fontSize)
                .style('font-family', nodeTextProperties.fontFamily)
                .style('font-weight', nodeTextProperties.fontWeight)
                .style('font-style', nodeTextProperties.fontStyle)
                .text(function (node) {
                textProperties.text = node.data.name;
                return GetTailoredTextOrDefault(textProperties, maxAllowedTextwidth);
            });
            nodeTextGroup.append('title')
                .text(function (node) {
                return node.data.name;
            });
            var svgRect = nodeText.node().getBBox();
            if (nodeTextProperties.showTextInsideShape) {
                if (nodeImageProperties.showImage) {
                    var textTransform = function () {
                        var x = 0;
                        var y = 0;
                        if (nodeImageProperties.position == Position.left) {
                            x = -_this.nodeShapeWidth / 2 + nodeImageProperties.width + nodeImageProperties.xOffset + nodeTextProperties.textPadding;
                            y = 0;
                        }
                        else if (nodeImageProperties.position == Position.right) {
                            x = -_this.nodeShapeWidth / 2 + nodeTextProperties.textPadding + nodeTextProperties.textPadding;
                            y = 0;
                        }
                        return Translate(x, y);
                    };
                    var getTailoredTextBasedOnImage = function (node) {
                        var tailoredText = '';
                        textProperties.text = node.data.name;
                        if (nodeImageProperties.position == Position.left) {
                            tailoredText = GetTailoredTextOrDefault(textProperties, _this.nodeShapeWidth - nodeImageProperties.width + Math.abs(nodeImageProperties.xOffset) - nodeTextProperties.textPadding);
                        }
                        else if (nodeImageProperties.position == Position.right) {
                            tailoredText = GetTailoredTextOrDefault(textProperties, _this.nodeShapeWidth - nodeImageProperties.width + nodeImageProperties.xOffset - nodeTextProperties.textPadding);
                        }
                        return tailoredText;
                    };
                    nodeText.style('text-anchor', 'start')
                        .text(getTailoredTextBasedOnImage);
                    nodeTextGroup.attr('transform', textTransform);
                }
                else {
                    nodeText.style('text-anchor', 'middle');
                    nodeTextGroup.attr('transform', Translate(0, 0));
                }
            }
            else if (generalProperties.orientation == Orientation.horizontal) {
                nodeTextGroup.attr('transform', function (node) {
                    var x = 0;
                    var y = 0;
                    if (node.children) {
                        x = -(svgRect.width + nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + _this.nodeShapeWidth / 2);
                    }
                    else {
                        x = nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + _this.nodeShapeWidth / 2;
                    }
                    return Translate(x, y);
                });
            }
            else if (generalProperties.orientation == Orientation.vertical) {
                nodeTextGroup.attr('transform', function (node) {
                    var x = svgRect.width / 2;
                    var y = svgRect.height / 2 + nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + _this.nodeShapeHeight / 2;
                    if (node.children) {
                        return Translate(-x, -y);
                    }
                    else {
                        return Translate(-x, y);
                    }
                });
            }
            if (nodeTextProperties.showBackground && !nodeTextProperties.showTextInsideShape) {
                nodeTextGroup.insert('rect', 'text')
                    .attr('x', svgRect.x - nodeTextProperties.textPadding / 2)
                    .attr('y', svgRect.y - nodeTextProperties.textPadding / 2)
                    .attr('height', svgRect.height + nodeTextProperties.textPadding)
                    .attr('width', svgRect.width + nodeTextProperties.textPadding)
                    .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
            }
            // select(elements[i]).attr('transform', Translate(10, 0));
            // console.log(elements[i]);
        });
        // nodeTextEnter.append('text')
        //     .attr('fill', nodeTextProperties.foregroundColor)
        //     .style('dominant-baseline', 'middle')
        //     .style('font-size', nodeTextProperties.fontSize)
        //     .style('font-family', nodeTextProperties.fontFamily)
        //     .style('font-weight', nodeTextProperties.fontWeight)
        //     .style('font-style', nodeTextProperties.fontStyle);
        // if (generalProperties.orientation == TreeOrientation.vertical) {
        //     this._createNodeTextForVerticalTree(nodeTextEnter);
        // } else {
        //     this._createNodeTextForHorizontalTree(nodeTextEnter);
        // }
        // if (nodeTextProperties.showBackground) {
        //     this.nodesEnter.selectAll('g.nodeText')
        //         .insert('rect', 'text')
        //         .each((d, i, elements) => {
        //             let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
        //             select(elements[i])
        //                 .attr('x', svgRect.x - nodeTextProperties.textPadding / 2)
        //                 .attr('y', svgRect.y - nodeTextProperties.textPadding / 2)
        //                 .attr('height', svgRect.height + nodeTextProperties.textPadding)
        //                 .attr('width', svgRect.width + nodeTextProperties.textPadding)
        //                 .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
        //         });
        // }
    };
    D3Tree.prototype._createNodeTextForHorizontalTree = function (nodeTextEnter) {
        // let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        // let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;
        // nodeTextEnter.selectAll('text')
        //     .attr('x', adjustXValue)
        //     .style('text-anchor', (node: TreePointNode<any>) => {
        //         let textAnchor = node.children ? 'end': 'start';
        //         return textAnchor;
        //     })
        //     .text((node: any) => {
        //         return node.data.name;
        //     });
        // this.nodes.select('g.nodeText').select('text')
        //     .attr('x', adjustXValue);
        // let nodeTexts = this.treeGroup.selectAll('text.nodeText')
        //     .data(this.treeDataArray)
        //     .enter()
        //     .append('g')
        //     .attr('transform', (d:any) => {
        //         let translate = d.children ? Translate(d.y - nodeShapeProperties.size - 8, d.x) :
        //             Translate(d.y + nodeShapeProperties.size + 8, d.x);
        //         return translate;
        //     });
        // nodeTexts.append('text')
        //     .attr('fill', nodeTextProperties.foregroundColor)
        //     .style('dominant-baseline', 'central')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });
        // nodeTexts.style('text-anchor', (d: any, i, elements) => {
        //         let textAnchor = d.children ? 'end': 'start';
        //         return textAnchor;
        //     });
        // nodeTexts.append('title')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });
        // if (nodeTextProperties.enableBackground) {
        //     nodeTexts.insert('rect', 'text')
        //     .each((d, i, elements) => {
        //         let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
        //         select(elements[i])
        //             .attr('x', svgRect.x - 2)
        //             .attr('y', svgRect.y - 2)
        //             .attr('height', svgRect.height + 4)
        //             .attr('width', svgRect.width + 4)
        //             .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
        //     });
        // }
    };
    D3Tree.prototype._createNodeTextForVerticalTree = function (nodeTextEnter) {
        // let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        // let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;
        // let textProperties: TextProperties = {
        //     'fontFamily': nodeTextProperties.fontFamily,
        //     'fontSize': nodeTextProperties.fontSize
        // };
        // let maxAllowedTextwidth = nodeTextProperties.maxAllowedWidth - (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);
        // nodeTextEnter.selectAll('text')
        //     .attr('y', (node: TreePointNode<any>) => {
        //         let totalSpacing = 0;
        //         let backgroundSpacing = nodeTextProperties.showBackground ? nodeTextProperties.textPadding / 2: 0;
        //         if (node.children) {
        //             totalSpacing = -this.nodeShapeHeight - nodeTextProperties.spaceBetweenNodeAndText - backgroundSpacing;
        //         } else {
        //             totalSpacing = this.nodeShapeHeight + nodeTextProperties.spaceBetweenNodeAndText * 2 + backgroundSpacing;
        //         }
        //         return totalSpacing;
        //     })
        //     .style('text-anchor', 'middle')
        //     .text((node: TreePointNode<any>) => {
        //         textProperties.text = node.data.name;
        //         return GetTailoredTextOrDefault(textProperties, maxAllowedTextwidth);
        //     });
        // let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        // let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;
        // let nodeTexts = this.treeGroup.selectAll('text.nodeText')
        //     .data(this.treeDataArray)
        //     .enter()
        //     .append('g')
        //     .attr('transform', (d:any) => {
        //         return Translate(d.x + nodeShapeProperties.size + 8, d.y)
        //     });
        // nodeTexts.append('text')
        //     .attr('fill', nodeTextProperties.foregroundColor)
        //     .style('dominant-baseline', 'central')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });
        // nodeTexts.style('text-anchor', (d: any, i, elements) => {
        //     let textWidth: number = (elements[i] as any).getBBox().width;
        //     let textAnchor = (textWidth < nodeShapeProperties.size) ? 'middle' : 'start';
        //     return textAnchor;
        // });
        // nodeTexts.append('title')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });
        // if (nodeTextProperties.showBackground) {
        //     nodeTexts.insert('rect', 'text')
        //     .each((d, i, elements) => {
        //         let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
        //         select(elements[i])
        //             .attr('x', svgRect.x - 2)
        //             .attr('y', svgRect.y - 2)
        //             .attr('height', svgRect.height + 4)
        //             .attr('width', svgRect.width + 4)
        //             .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
        //     });
        // }
    };
    D3Tree.prototype._createNodeLinks = function () {
        var treeLinkProperties = this.treeProperties.linkProperties;
        var generalProperties = this.treeProperties.generalProperties;
        var nodeAnimationDuration = this.treeProperties.nodeProperties.animationDuration;
        var horizontalCurveLink = linkHorizontal()
            .x(function (node) { return node.x; })
            .y(function (node) { return node.y; });
        var verticalCurveLink = linkVertical()
            .x(function (node) { return node.x; })
            .y(function (node) { return node.y; });
        var straightLink = function (source, target) {
            return "M" + source.x + "," + source.y +
                "L" + target.x + "," + target.y;
        };
        var nodePerpendicularLineLength = 0;
        if (generalProperties.orientation == Orientation.horizontal) {
            nodePerpendicularLineLength = this.nodeShapeWidth / 2 + (this.nodeShapeWidth + generalProperties.extraPerLevelDepth) * 0.4;
        }
        else {
            nodePerpendicularLineLength = this.nodeShapeHeight / 2 + (this.nodeShapeHeight + generalProperties.extraPerLevelDepth) * 0.4;
        }
        var horizontalCornerLink = function (source, target) {
            return "M" + source.x + "," + source.y +
                "H" + (source.x + nodePerpendicularLineLength) +
                "V" + target.y +
                "H" + target.x;
        };
        var verticalCornerLink = function (source, target) {
            return "M" + source.x + "," + source.y +
                "V" + (source.y + nodePerpendicularLineLength) +
                "H" + target.x +
                "V" + target.y;
        };
        var createPath = function (nodeLink) {
            if (treeLinkProperties.treeNodeLinkType == LineType.curved) {
                if (generalProperties.orientation == Orientation.horizontal) {
                    return horizontalCurveLink(nodeLink);
                }
                else {
                    return verticalCurveLink(nodeLink);
                }
            }
            else if (treeLinkProperties.treeNodeLinkType == LineType.straight) {
                return straightLink(nodeLink.source, nodeLink.target);
            }
            else if (treeLinkProperties.treeNodeLinkType == LineType.corner) {
                if (generalProperties.orientation == Orientation.horizontal) {
                    return horizontalCornerLink(nodeLink.source, nodeLink.target);
                }
                else {
                    return verticalCornerLink(nodeLink.source, nodeLink.target);
                }
            }
        };
        var nodeLinks = this.treeGroup.selectAll('path.link')
            .data(this.treeDataLinks, function (nodeLink) {
            return (nodeLink.source.data.name + nodeLink.target.data.name + nodeLink.source.x + nodeLink.target.y);
        });
        var nodeLinksEnter = nodeLinks.enter()
            .insert("path", "g") //will insert path before g elements
            .classed('link', true)
            .attr('fill', 'none')
            .attr('stroke', treeLinkProperties.strokeColor)
            .attr('stroke-width', treeLinkProperties.strokeWidth)
            .attr('d', createPath);
        nodeLinksEnter.append('title')
            .text(function (nodeLink) {
            return nodeLink.source.data.name + " -> " + nodeLink.target.data.name;
        });
        if (treeLinkProperties.animation) {
            nodeLinksEnter.each(function (nodeLink, i, elements) {
                var linkLength = elements[i].getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", linkLength)
                    .transition()
                    .delay(nodeAnimationDuration - (nodeAnimationDuration / 3))
                    .duration(treeLinkProperties.animationDuration)
                    // .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", 0);
            });
            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .transition()
                .duration(treeLinkProperties.animationDuration)
                .attr('d', createPath);
            nodeLinks.exit()
                .each(function (nodeLink, i, elements) {
                var linkLength = elements[i].getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", 0)
                    .attr('opacity', 1)
                    .transition()
                    .duration(treeLinkProperties.animationDuration)
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
    return D3Tree;
}());
export { D3Tree };
//# sourceMappingURL=D3Tree.js.map