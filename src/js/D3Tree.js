import { ShapeType, Orientation, LineType, Position } from './D3TreeInterfaces';
import { tree, hierarchy, cluster } from 'd3-hierarchy';
import { SVGUtils } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { select, event } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import 'd3-transition';
// SVG Utils
var Translate = SVGUtils.Translate;
var MeasureTextSize = SVGUtils.MeasureTextSize;
var GetTailoredTextOrDefault = SVGUtils.GetTailoredTextOrDefault;
var ValidateBoundary = SVGUtils.ValidateBoundary;
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
        this.nodeUID = 0; // Used to uniquely identify nodes in tree and it will be used by d3 data joins for enter, update and exit
        this._setDefaultValuesForOptionalTreeProperties();
    }
    /**
     * Call this function which will create initial tree structure based on `generalProperties` specified in
     * `treeProperties` in constructor.
     */
    D3Tree.prototype.CreateTree = function () {
        var generalProperties = this.treeProperties.generalProperties;
        var nodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        var nodeTextProperties = this.treeProperties.nodeProperties.textProperties;
        // set text style which will be used later to calculated text size in px.
        this.textStyleProperties = {
            fontFamily: nodeTextProperties.fontFamily,
            fontSize: nodeTextProperties.fontSize,
            fontStyle: nodeTextProperties.fontStyle,
            fontWeight: nodeTextProperties.fontWeight
        };
        // Generate hierarchy data which gives depth, height and other info.
        this.hierarchyData = hierarchy(this.data, function (treeDatum) {
            return treeDatum.children;
        });
        /**
         * Recursive function used to collapse tree nodes based on defaultMaxDepth property of generalSettings.
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
        if (nodeShapeProperties.shapeType == ShapeType.Circle) {
            this.nodeShapeHeight = this.nodeShapeWidth = 2 * nodeShapeProperties.circleRadius;
        }
        else if (nodeShapeProperties.shapeType == ShapeType.Rectangle) {
            this.nodeShapeHeight = nodeShapeProperties.rectHeight;
            this.nodeShapeWidth = nodeShapeProperties.rectWidth;
        }
        // if text needs to be shown inside the shape then we set `maxAllowedWidth` of text properties to size of node
        if (nodeTextProperties.showTextInsideShape) {
            nodeTextProperties.maxAllowedWidth = this.nodeShapeWidth;
        }
        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.enableZoom) {
            this.enableZoom = true;
            // this.rootSVG.style('cursor', 'grab')
        }
        this._updateTree(); // update the tree if already created or make a new tree.
        if (this.enableZoom) {
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
    D3Tree.prototype._setDefaultValuesForOptionalTreeProperties = function () {
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
        if (generalProperties.depthWiseHeight == undefined) {
            generalProperties.depthWiseHeight = 0;
        }
        if (generalProperties.minZoomScale == undefined) {
            generalProperties.minZoomScale = 0.2;
        }
        if (generalProperties.maxZoomScale == undefined) {
            generalProperties.minZoomScale = 3;
        }
        if (generalProperties.nodeSize == undefined) {
            generalProperties.nodeSize = 10;
        }
        if (generalProperties.horizontalPadding == undefined) {
            generalProperties.horizontalPadding = 20;
        }
        if (generalProperties.verticalPadding == undefined) {
            generalProperties.verticalPadding = 20;
        }
        // node properties
        if (nodeProperties.animationDuration == undefined) {
            nodeProperties.animationDuration = 1000;
        }
        // node shape properties
        if (nodeShapeProperties.takeColorFromData == undefined) {
            nodeShapeProperties.takeColorFromData = false;
        }
        if (nodeShapeProperties.circleRadius == undefined) {
            nodeShapeProperties.circleRadius = 10;
        }
        if (nodeShapeProperties.rectWidth == undefined) {
            nodeShapeProperties.rectWidth = 5;
        }
        if (nodeShapeProperties.rectHeight == undefined) {
            nodeShapeProperties.rectHeight = 5;
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
        if (nodeTextProperties.textPadding == undefined) {
            nodeTextProperties.textPadding = 0;
        }
        if (nodeTextProperties.showUrlOnText == undefined) {
            nodeTextProperties.showUrlOnText = false;
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
            nodeImageProperties.shape = ShapeType.None;
        }
        if (nodeImageProperties.position == undefined) {
            nodeImageProperties.position = Position.Left;
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
    };
    /**
     * Creates D3 tree data based on json tree data provided in constructor.
     */
    D3Tree.prototype._createTreeData = function () {
        var _this = this;
        var generalProperties = this.treeProperties.generalProperties;
        var treeHeight;
        var treeWidth;
        if (this.enableZoom) {
            treeHeight = 100; // assign random height because level spacing will be calculated later based on depthWiseHeight.
            treeWidth = this.hierarchyData.leaves().length * generalProperties.nodeSize;
            // zoom will change transform of group element which is child of root SVG and parent of tree
            var treeGroupZoomAction = function () {
                _this.treeGroup.attr('transform', event.transform);
            };
            // listener will be attached to root SVG.
            this.rootSVGZoomListener = zoom().scaleExtent([generalProperties.minZoomScale, generalProperties.maxZoomScale])
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
            this.rootSVG.call(this.rootSVGZoomListener)
                .on('dblclick.zoom', function () {
                // center to root node on double click.
                _this._centerNode(_this.treeNodes);
            })
                .on('ondragstart', function () {
                _this.rootSVG.style('cursor', 'grabbing');
            });
        }
        else {
            var translate = void 0;
            if (generalProperties.orientation == Orientation.Horizontal) {
                treeHeight = generalProperties.containerWidth - generalProperties.verticalPadding * 2;
                treeWidth = generalProperties.containerHeight - generalProperties.horizontalPadding * 2;
                translate = Translate(generalProperties.verticalPadding, generalProperties.horizontalPadding);
            }
            else {
                treeHeight = generalProperties.containerHeight - generalProperties.verticalPadding * 2;
                treeWidth = generalProperties.containerWidth - generalProperties.horizontalPadding * 2;
                translate = Translate(generalProperties.horizontalPadding, generalProperties.verticalPadding);
            }
            this.treeGroup.transition()
                .duration(1000)
                .attr('transform', translate);
        }
        if (generalProperties.isClusterLayout) {
            this.treeLayout = cluster().size([treeWidth, treeHeight]);
        }
        else {
            this.treeLayout = tree().size([treeWidth, treeHeight]);
        }
        // get final data
        this.treeNodes = this.treeLayout(this.hierarchyData);
        this.treeNodeArray = this.treeNodes.descendants();
        this.treeNodeArray.forEach(function (node) {
            if (generalProperties.enableZoom) {
                node.y = node.depth * generalProperties.depthWiseHeight;
            }
            else if (!node.children && node.depth == 0) {
                node.x = generalProperties.containerWidth / 2;
                node.y = generalProperties.containerHeight / 2;
                _this.treeGroup.transition()
                    .duration(1000)
                    .attr('transform', Translate(0, 0));
            }
            // if orientation is horizontal than swap the x and y.
            if (generalProperties.orientation == Orientation.Horizontal) {
                node.x = node.x + node.y;
                node.y = node.x - node.y;
                node.x = node.x - node.y;
            }
        });
        this.treeLinks = this.treeNodes.links();
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
        this.nodesEnter.on('click', function (node) {
            if (node.children || node._children) {
                if (node.children) { // collapse
                    node._children = node.children;
                    node.children = null;
                }
                else if (node._children) { // expand
                    node.children = node._children;
                    node._children = null;
                }
                _this._updateTree();
            }
            if (_this.enableZoom) {
                _this._centerNode(node);
            }
        })
            .on('mouseover', function (node, i, elements) {
            if (node.children || node._children) {
                select(elements[i]).style('cursor', 'pointer');
            }
        });
        // animation will be applicable for whole node i.e. shape, text, image etc.
        if (nodeProperties.enableAnimation) {
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
                return node._children ? nodeShapeProperties.collapsedColor : nodeShapeProperties.expandedColor;
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
                return node._children ? nodeShapeProperties.collapsedColor : nodeShapeProperties.expandedColor;
            });
            this.nodes.exit().remove();
        }
    };
    D3Tree.prototype._createNodeShapes = function () {
        var nodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        var nodeShape = this.nodesEnter.append('g')
            .classed('node-shape', true);
        if (nodeShapeProperties.shapeType == ShapeType.Circle) {
            nodeShape = nodeShape.append('circle')
                .attr('r', nodeShapeProperties.circleRadius);
        }
        else if (nodeShapeProperties.shapeType == ShapeType.Rectangle) {
            nodeShape = nodeShape.append('rect')
                .attr('x', 0 - nodeShapeProperties.rectWidth / 2)
                .attr('y', 0 - nodeShapeProperties.rectHeight / 2)
                .attr('height', nodeShapeProperties.rectHeight)
                .attr('width', nodeShapeProperties.rectWidth);
        }
        nodeShape.attr('fill', function (node) {
            if (nodeShapeProperties.takeColorFromData && node.nodeColor) {
                return node.nodeColor;
            }
            else {
                return node._children ? nodeShapeProperties.collapsedColor : nodeShapeProperties.expandedColor;
            }
        })
            .attr('stroke', function (node) {
            if (nodeShapeProperties.takeColorFromData && node.nodeColor) {
                return node._children ? nodeShapeProperties.collapsedColor : nodeShapeProperties.expandedColor;
            }
            else {
                return nodeShapeProperties.strokeColor;
            }
        })
            .attr('stroke-width', nodeShapeProperties.strokeWidth);
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
            var positiveX = _this.nodeShapeWidth / 2;
            var negativeX = -_this.nodeShapeWidth / 2 - nodeImageProperties.width;
            if (!_this.treeProperties.nodeProperties.textProperties.showTextInsideShape) {
                x = -nodeImageProperties.width / 2;
            }
            else if (nodeImageProperties.position == Position.Left) {
                x = -_this.nodeShapeWidth / 2 + nodeImageProperties.xOffset;
                x = ValidateBoundary(x, positiveX, negativeX);
            }
            else if (nodeImageProperties.position == Position.Right) {
                x = _this.nodeShapeWidth / 2 - nodeImageProperties.width + nodeImageProperties.xOffset;
                x = ValidateBoundary(x, positiveX, negativeX);
            }
            else if (nodeImageProperties.position == Position.Top || nodeImageProperties.position == Position.Bottom) {
                x = -nodeImageProperties.width / 2;
            }
            return x;
        };
        var imageY = function () {
            var y = 0;
            var positiveY = _this.nodeShapeHeight / 2;
            var negativeY = -_this.nodeShapeHeight / 2 - nodeImageProperties.height;
            if (nodeImageProperties.position == Position.Left || nodeImageProperties.position == Position.Right) {
                y = -nodeImageProperties.height / 2;
            }
            else if (nodeImageProperties.position == Position.Top) {
                y = -_this.nodeShapeHeight / 2 - nodeImageProperties.yOffset;
                y = ValidateBoundary(y, positiveY, negativeY);
            }
            else if (nodeImageProperties.position == Position.Bottom) {
                y = _this.nodeShapeHeight / 2 - nodeImageProperties.height - nodeImageProperties.yOffset;
                y = ValidateBoundary(y, positiveY, negativeY);
            }
            return y;
        };
        if (nodeImageProperties.shape != ShapeType.None) {
            var nodeImageShapeEnter = void 0;
            if (nodeImageProperties.shape == ShapeType.Circle) {
                nodeImageShapeEnter = nodeImageEnter.append('circle')
                    .attr('r', function () {
                    return nodeImageProperties.height / 2;
                })
                    .attr('cx', imageX() + nodeImageProperties.width / 2)
                    .attr('cy', 0);
            }
            else if (nodeImageProperties.shape == ShapeType.Rectangle) {
                nodeImageShapeEnter = nodeImageEnter.append('rect')
                    .attr('height', nodeImageProperties.height)
                    .attr('width', nodeImageProperties.width)
                    .attr('x', imageX)
                    .attr('y', imageY);
            }
            nodeImageShapeEnter.attr('stroke', nodeImageProperties.strokeColor)
                .attr('stroke-width', nodeImageProperties.strokeWidth)
                .attr('fill', 'none');
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
        this.rootSVG.transition().duration(1000).call(this.rootSVGZoomListener.transform, zoomIdentity.translate(x, y).scale(t.k));
    };
    D3Tree.prototype._createNodeText = function () {
        var _this = this;
        var generalProperties = this.treeProperties.generalProperties;
        var nodeTextProperties = this.treeProperties.nodeProperties.textProperties;
        var nodeImageProperties = this.treeProperties.nodeProperties.imageProperties;
        var maxAllowedTextWidth = nodeTextProperties.maxAllowedWidth - nodeTextProperties.textPadding * 2;
        var textHeight = MeasureTextSize(this.textStyleProperties, this.treeNodes.data.name).height;
        var nodeTextGroupTransformHorizontal = function (node, i, elements) {
            var x = 0;
            var y = 0;
            var nodeText = select(elements[i]).select('text');
            nodeText.style('text-anchor', 'start');
            if (node.children) {
                var nodeTextSize = nodeText.node().getBBox();
                x = -nodeTextProperties.spaceBetweenNodeAndText - nodeTextSize.width;
                if (nodeTextProperties.showBackground) {
                    x -= nodeTextProperties.textPadding;
                }
            }
            else {
                x = nodeTextProperties.spaceBetweenNodeAndText;
                if (nodeTextProperties.showBackground) {
                    x += nodeTextProperties.textPadding;
                }
            }
            return Translate(x, y);
        };
        var nodeTextGroupTransformVertical = function (node) {
            var x = 0;
            var y = 0;
            if (node.children) {
                y = -nodeTextProperties.spaceBetweenNodeAndText - _this.nodeShapeHeight / 2;
                if (nodeTextProperties.showBackground) {
                    y -= nodeTextProperties.textPadding;
                }
            }
            else {
                y = nodeTextProperties.spaceBetweenNodeAndText + _this.nodeShapeHeight / 2;
                if (nodeTextProperties.showBackground) {
                    y += nodeTextProperties.textPadding;
                }
            }
            return Translate(x, y);
        };
        var nodeTextEnter = this.nodesEnter
            .append('g')
            .classed('node-text', true)
            .each(function (node, i, elements) {
            var nodeTextGroup = select(elements[i]);
            var nodeText;
            if (nodeTextProperties.showUrlOnText) {
                nodeText = nodeTextGroup.each(function (node, i, elements) {
                    if (node.externalURL) {
                        select(elements[i]).append('a')
                            .attr('xlink:href', function (node) {
                            if (node.externalURL) {
                                return node.externalURL;
                            }
                        })
                            .attr('target', 'blank')
                            .style('text-decoration', 'underline');
                    }
                });
            }
            nodeText = nodeText.append('text')
                .attr('fill', nodeTextProperties.foregroundColor)
                .style('dominant-baseline', 'middle')
                .style('font-size', nodeTextProperties.fontSize)
                .style('font-family', nodeTextProperties.fontFamily)
                .style('font-weight', nodeTextProperties.fontWeight)
                .style('font-style', nodeTextProperties.fontStyle)
                .text(function (node) {
                return GetTailoredTextOrDefault(_this.textStyleProperties, maxAllowedTextWidth, node.data.name);
            });
            nodeTextGroup.append('title')
                .text(function (node) {
                return node.data.name;
            });
            if (nodeTextProperties.showTextInsideShape && nodeImageProperties.showImage) {
                var textTransformWhenShowImage = function () {
                    var x = 0;
                    var y = 0;
                    var positiveX = 0;
                    var negativeX = 0;
                    var positiveY = 0;
                    var negativeY = 0;
                    if (nodeImageProperties.position == Position.Left) {
                        nodeText.style('text-anchor', 'start');
                        positiveX = _this.nodeShapeWidth / 2 + nodeImageProperties.width + nodeTextProperties.textPadding;
                        negativeX = -_this.nodeShapeWidth / 2 + nodeTextProperties.textPadding;
                        x = -_this.nodeShapeWidth / 2 + nodeImageProperties.width + nodeImageProperties.xOffset + nodeTextProperties.textPadding;
                        x = ValidateBoundary(x, positiveX, negativeX);
                    }
                    else if (nodeImageProperties.position == Position.Right) {
                        nodeText.style('text-anchor', 'start');
                        x = -_this.nodeShapeWidth / 2 + nodeTextProperties.textPadding;
                    }
                    else if (nodeImageProperties.position == Position.Top) {
                        nodeText.style('text-anchor', 'middle');
                        positiveY = _this.nodeShapeHeight / 2 + textHeight / 2 + nodeTextProperties.textPadding + nodeImageProperties.width;
                        negativeY = -_this.nodeShapeHeight / 2 + textHeight / 2 + nodeTextProperties.textPadding;
                        y = -nodeImageProperties.yOffset + textHeight / 2 + nodeTextProperties.textPadding - (_this.nodeShapeHeight / 2 - nodeImageProperties.height);
                        y = ValidateBoundary(y, positiveY, negativeY);
                    }
                    else if (nodeImageProperties.position == Position.Bottom) {
                        nodeText.style('text-anchor', 'middle');
                        positiveY = _this.nodeShapeHeight / 2 - textHeight / 2 - nodeTextProperties.textPadding;
                        negativeY = -_this.nodeShapeHeight / 2 - textHeight / 2 - nodeTextProperties.textPadding - nodeImageProperties.height;
                        y = -nodeImageProperties.yOffset - textHeight / 2 - nodeTextProperties.textPadding + (_this.nodeShapeHeight / 2 - nodeImageProperties.height);
                        y = ValidateBoundary(y, positiveY, negativeY);
                    }
                    return Translate(x, y);
                };
                var getTailoredTextBasedOnImage = function (node) {
                    var tailoredText = '';
                    if (nodeImageProperties.position == Position.Left || nodeImageProperties.position == Position.Right) {
                        tailoredText = GetTailoredTextOrDefault(_this.textStyleProperties, _this.nodeShapeWidth - nodeImageProperties.width + nodeImageProperties.xOffset - nodeTextProperties.textPadding * 2, node.data.name);
                    }
                    else if (nodeImageProperties.position == Position.Top || nodeImageProperties.position == Position.Bottom) {
                        tailoredText = GetTailoredTextOrDefault(_this.textStyleProperties, maxAllowedTextWidth, node.data.name);
                    }
                    return tailoredText;
                };
                nodeText.text(getTailoredTextBasedOnImage);
                nodeTextGroup.attr('transform', textTransformWhenShowImage);
            }
            else if (nodeTextProperties.showTextInsideShape) {
                nodeText.style('text-anchor', 'middle');
                nodeTextGroup.attr('transform', Translate(0, 0));
            }
            else if (generalProperties.orientation == Orientation.Horizontal) {
                nodeTextGroup.attr('transform', nodeTextGroupTransformHorizontal);
            }
            else if (generalProperties.orientation == Orientation.Vertical) {
                nodeText.style('text-anchor', 'middle');
                nodeText.style('dominant-baseline', 'central');
                nodeTextGroup.attr('transform', nodeTextGroupTransformVertical);
            }
            if (nodeTextProperties.showBackground) {
                var nodeTextSize = nodeText.node().getBBox();
                nodeTextGroup.insert('rect', 'text')
                    .attr('x', nodeTextSize.x - nodeTextProperties.textPadding / 2)
                    .attr('y', nodeTextSize.y - nodeTextProperties.textPadding / 2)
                    .attr('height', nodeTextSize.height + nodeTextProperties.textPadding)
                    .attr('width', nodeTextSize.width + nodeTextProperties.textPadding)
                    .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
            }
        });
        if (!nodeTextProperties.showTextInsideShape) {
            var nodeTextUpdate = this.nodes.select('.node-text');
            var transformFunction = void 0;
            if (generalProperties.orientation == Orientation.Horizontal) {
                transformFunction = nodeTextGroupTransformHorizontal;
            }
            else {
                transformFunction = nodeTextGroupTransformVertical;
            }
            if (this.treeProperties.nodeProperties.enableAnimation) {
                nodeTextUpdate.transition()
                    .duration(this.treeProperties.nodeProperties.animationDuration)
                    .attr('transform', transformFunction);
            }
            else {
                nodeTextUpdate.attr('tranform', transformFunction);
            }
        }
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
        if (generalProperties.orientation == Orientation.Horizontal) {
            nodePerpendicularLineLength = this.nodeShapeWidth / 2 + generalProperties.depthWiseHeight * 0.25;
        }
        else {
            nodePerpendicularLineLength = this.nodeShapeHeight / 2 + generalProperties.depthWiseHeight * 0.25;
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
            if (treeLinkProperties.treeNodeLinkType == LineType.Curved) {
                if (generalProperties.orientation == Orientation.Horizontal) {
                    return horizontalCurveLink(nodeLink);
                }
                else {
                    return verticalCurveLink(nodeLink);
                }
            }
            else if (treeLinkProperties.treeNodeLinkType == LineType.Straight) {
                return straightLink(nodeLink.source, nodeLink.target);
            }
            else if (treeLinkProperties.treeNodeLinkType == LineType.Corner) {
                if (generalProperties.orientation == Orientation.Horizontal) {
                    return horizontalCornerLink(nodeLink.source, nodeLink.target);
                }
                else {
                    return verticalCornerLink(nodeLink.source, nodeLink.target);
                }
            }
        };
        var nodeLinks = this.treeGroup.selectAll('path.link')
            .data(this.treeLinks, function (nodeLink) {
            return (nodeLink.source.data.name + nodeLink.target.data.name + nodeLink.source.x + nodeLink.target.y);
        });
        var nodeLinksEnter = nodeLinks.enter()
            .insert("path", "g") // will insert path before g elements
            .classed('link', true)
            .attr('fill', 'none')
            .attr('stroke', treeLinkProperties.strokeColor)
            .attr('stroke-width', treeLinkProperties.strokeWidth)
            .attr('d', createPath);
        nodeLinksEnter.append('title')
            .text(function (nodeLink) {
            return nodeLink.source.data.name + " -> " + nodeLink.target.data.name;
        });
        if (treeLinkProperties.enableAnimation) {
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