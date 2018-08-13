import { 
    TreeGeneralProperties, TreeNodeLinkProperties, TreeNodeTextProperties, TreeProperties,
    TreeNodeShapeProperties, TreeNodeShapeTypes, TreeOrientation, TreeNodeLinkTypes
} from './D3TreeInterfaces';
import { 
    tree, hierarchy, TreeLayout, HierarchyPointNode,
    cluster, HierarchyPointLink, HierarchyNode
} from 'd3-hierarchy';
import { SVGUtils, TextProperties } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { Selection, select, BaseType, event } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior, zoomTransform } from 'd3-zoom';
import { max } from 'd3-array';
import * as d3_ease from 'd3-ease';
import 'd3-transition';

//svgutils
let Translate = SVGUtils.Translate;
let MeasureTextSize = SVGUtils.MeasureTextSize;
let GetTailoredTextOrDefault = SVGUtils.GetTailoredTextOrDefault;

export class D3Tree {

    private treeGroup: Selection<BaseType, any, any, any>; // Holds the parent group element of the tree.
    private treeMap: TreeLayout<any>; // Holds defination of funtion to create tree layout based on given tree type, size and hierarhcy data.
    private hierarchyData: HierarchyNode<any>; // Holds hierarchy data which gives information such as depth and height of the nodes and other info.
    private treeData: HierarchyPointNode<any>; // Holds tree data created from treeMap and hierarchyData with info such as x and y coordinate of the node.
    private treeDataArray: HierarchyPointNode<any>[]; // Holds nodes in form of array in chronological order from top to bottom.
    private treeDataLinks: HierarchyPointLink<any>[]; // Holds defination of links between nodes.
    private dynamicHeightAndWidth: boolean = false; // enable zoom when there is no treeheight and width is provided.
    private maxExpandedDepth: number; // will store max depth of tree visible on screen
    private rootSVGZoomListner: ZoomBehavior<Element, {}>;

    // node variables *******************************************************************************************************
    // holds all nodes selection i.e. nodes that needs to be created, updated or removed.
    private nodes: Selection<BaseType, HierarchyPointNode<any>, BaseType, any>;
    // holds all nodes that needs to created.
    private nodesEnter: Selection<BaseType, HierarchyPointNode<any>, BaseType, any>;
    private nodeShapeSize: number; // in case of circle 2*nodeShapeProperties.size, in case of square nodeShapeProperties.size

    /**
     * 
     * @param rootSVG Root SVG element where tree will be created
     * @param data JSON Data in form of tree structure
     * @param treeProperties TreeProperties object that specifies different properties and settings of the tree.
     */
    constructor (private rootSVG: Selection<BaseType, any, any, any>, private data: any, private readonly treeProperties: TreeProperties) { 
        this._setDefaultValuesForTreeProperties();
    }

    /**
     * Call this funtion wich will create initial tree structure based on generalProperties specified in
     * treeProperties in constructor
     */
    CreateTree() {
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;

        // set maxExpandedDepth to defaultMaxDepth
        this.maxExpandedDepth = generalProperties.defaultMaxDepth;

        // Generate hierarchy data which gives depth, height and other info.
        this.hierarchyData = hierarchy(this.data, (d: any) => {
            return d.children;
        });

        /**
         * Recursive funtion used to collapse tree nodes based on defaultMaxDepth property of generalSettings.
         * @param node tree node
         */
        let collapseNodes = (node: any) => {
            if(node.children && node.depth >= generalProperties.defaultMaxDepth) {
                node._children = node.children
                node._children.forEach(collapseNodes);
                node.children = null
            }
        }
        this.hierarchyData.each(collapseNodes); // collapse tree nodes based on DefaultMaxDepth

        // add parent group for tree to rootSVG element.
        this.treeGroup = this.rootSVG
            .append('g')
            .classed('treeGroup', true);

        // calculate node size for spacing purpose
        if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
            this.nodeShapeSize = 2 * nodeShapeProperties.size;
        } else {
            this.nodeShapeSize = nodeShapeProperties.size;
        }

        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.treeHeight == undefined && generalProperties.treeWidth == undefined) {
            this.dynamicHeightAndWidth = true;
        } else {
            generalProperties.treeHeight = generalProperties.treeHeight - this.nodeShapeSize * 4;
            generalProperties.treeWidth = generalProperties.treeWidth - this.nodeShapeSize * 4;
            this.treeGroup.attr('transform', Translate(this.nodeShapeSize* 2, this.nodeShapeSize * 2))
        }

        this._updateTree(); // update the tree if already created or make a new tree.
        this._centerNode(this.treeData); // center the root node.
    }

    /**
     * Updates the tree such as updating nodes, nodes shapes, node links etc.
     */
    private _updateTree() {
        this._createTreeData();
        this._createNodeGroups();
        this._createNodes();
        this._createNodeLinks();
        this._createNodeText();
    }

    private _setDefaultValuesForTreeProperties() {
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeLinkProperties: TreeNodeLinkProperties = this.treeProperties.nodeLinkProperties;
        let nodeTextproperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        // general properties
        if (generalProperties.isClusterLayout == undefined) {
            generalProperties.isClusterLayout = false;
        }
        if (generalProperties.depthWiseHeight == undefined) {
            generalProperties.depthWiseHeight = null;
        }

        // node shape properties
        if (nodeShapeProperties.animationDuration == undefined) {
            nodeShapeProperties.animationDuration = 1000;
        }

        // node link properties
        if (nodeLinkProperties.animationDuration == undefined) {
            nodeLinkProperties.animationDuration = 1000;
        }

        // node text properties
        if (nodeTextproperties.backgroundColor == undefined) {
            nodeTextproperties.backgroundColor = '#F2F2F2';
        }
        if (nodeTextproperties.fontWeight == undefined) {
            nodeTextproperties.fontWeight = 'normal';
        }
        if (nodeTextproperties.fontStyle == undefined) {
            nodeTextproperties.fontStyle = 'normal';
        }
        if (nodeTextproperties.spaceBetweenNodeAndText == undefined) {
            nodeTextproperties.spaceBetweenNodeAndText = 5;
        }
        if (nodeTextproperties.maxAllowedWidth == undefined) {
            nodeTextproperties.maxAllowedWidth = 50;
        }
        if (nodeTextproperties.textPadding == undefined) {
            nodeTextproperties.textPadding = 4;
        }
    }

    /**
     * Creates D3 tree data based on json data provided in constructor
     */
    private _createTreeData() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        // if dynaimicHeightSndWidth is true,s that means no treeheight or treewidth is provided
        // than we calculate it according to the tree data.
        if (this.dynamicHeightAndWidth) {
            
            // Find depth wise max children count to calculate proper tree height.
            // base code credit: http://bl.ocks.org/robschmuecker/7880033
            // let depthWiseChildrenCount: number[] = [1];
            // let countDepthwiseChildren = (level: number, node: any) => {
            //     if (node.children && node.children.length > 0 && level < this.maxExpandedDepth) {
            //         if (depthWiseChildrenCount.length <= level + 1) depthWiseChildrenCount.push(0);
            //         depthWiseChildrenCount[level + 1] += node.children.length;
            //         node.children.forEach((d) => {
            //             countDepthwiseChildren(level + 1, d);
            //         });
            //     }
            // };
            // countDepthwiseChildren(0, this.hierarchyData);

            // Find longest text present in tree calculate proper spacing between nodes.
            let maxTextWidth = 0;
            let textProperties: TextProperties = {
                'fontFamily': nodeTextProperties.fontFamily,
                'fontSize': nodeTextProperties.fontSize
            }
            let findMaxLabelLength = (level: number, node: any) => {
                let textWidth = MeasureTextSize(textProperties, node.data.name).width;
                if (node.children && node.children.length > 0 && level < this.maxExpandedDepth) {
                    node.children.forEach((element) => {
                        findMaxLabelLength(level + 1, element);
                    });
                }
                maxTextWidth = Math.max(textWidth, maxTextWidth);
            };
            findMaxLabelLength(0, this.hierarchyData);

            let textHeight = MeasureTextSize(textProperties, this.hierarchyData.data.name).height + 
                (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);

            // if node shape size is greater than text height than use that for treeHeight calculation
            let perNodeHeight = textHeight > this.nodeShapeSize ? textHeight : this.nodeShapeSize;
            let maxPerNodeTextWidth = nodeTextProperties.maxAllowedWidth + (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);
            generalProperties.treeWidth = maxTextWidth * (this.maxExpandedDepth + 1);
            if (generalProperties.orientation == TreeOrientation.horizontal) {
                generalProperties.treeHeight = this.hierarchyData.leaves().length * perNodeHeight;
            } else {
                generalProperties.treeHeight = this.hierarchyData.leaves().length * maxPerNodeTextWidth;
            }

            // console.log(treeHeight, treeWidth);

            // adding zoom to tree.
            let minZoomScale = Math.min(
                generalProperties.containerHeight / generalProperties.treeHeight,
                generalProperties.containerWidth / generalProperties.treeWidth
            );
            minZoomScale = minZoomScale - (minZoomScale * 0.05);
            // zoom will chnage transform of group element which is child of root SVG and parent of tree
            let treeGroupZoomAction = () => {
                this.treeGroup.attr('transform', event.transform);
            }

            // settings max translate extent for zooming
            // let maxTranslateX = generalProperties.containerWidth - (generalProperties.treeWidth * minZoomScale);
            // let maxTranslateY = generalProperties.containerHeight - (generalProperties.treeHeight * minZoomScale);

            // listner will be attached to root SVG.
            this.rootSVGZoomListner = zoom().scaleExtent([minZoomScale, 3])
                // .translateExtent([[0, 0], [generalProperties.containerWidth, generalProperties.containerHeight]])
                .on('zoom', treeGroupZoomAction)
                .filter(() => {
                    return (
                        (event as MouseEvent).button == 1 ||
                        event instanceof WheelEvent
                    );
                });
            this.rootSVG.call(this.rootSVGZoomListner);
        }

        if (generalProperties.isClusterLayout) {
            this.treeMap =  cluster().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        } else {
            this.treeMap =  tree().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        }

        // get final data
        this.treeData = this.treeMap(this.hierarchyData);
        this.treeDataArray = this.treeData.descendants();

        // if orientation is horizontal than swap the x and y
        if (generalProperties.orientation == TreeOrientation.horizontal) {
            this.treeDataArray.forEach((node) => {
                node.x = node.x + node.y;
                node.y = node.x - node.y;
                node.x = node.x - node.y;
            });
        }

        this.treeDataLinks = this.treeData.links();
    }

    /**
     * Updates nodes selection with latest data and adds new node groups into DOM.
     */
    private _createNodeGroups() {
        let nodeUID = 0; // Used to uniquely identify nodes in tree and it will be used by d3 data joins for enter, update and exit
        this.nodes = this.treeGroup.selectAll('g.node')
            .data(this.treeDataArray, (d: any) => {
                return (d.id || (d.id = ++nodeUID));
            });

        this.nodesEnter = this.nodes.enter()
            .append('g')
            .classed('node', true)
            .attr('transform', (d: HierarchyPointNode<any>) => {
                return Translate(d.x, d.y);
            });
    }

    private _createNodes() {
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let click = (node: any) => {
            if (node.children) { // collapse
                node._children = node.children;
                node.children = null;
            } else if(node._children) {  // expand
                node.children = node._children;
                node._children = null;
            }
            if (this.dynamicHeightAndWidth) {
                // finding maximum expanded depth for dynamic height calculation.
                this.maxExpandedDepth = max(this.hierarchyData.leaves().map((node) => { return node.depth }));
            }
            this._updateTree();
            this._centerNode(node);
        }

        if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
            this.nodesEnter.append('circle')
                .attr('r', nodeShapeProperties.size)
                .attr('stroke', nodeShapeProperties.stroke)
                .attr('stroke-width', nodeShapeProperties.strokeWidth);
        } else if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.square) {
            this.nodesEnter.append('rect')
                .attr('transform', (d: any) => {
                    let diff = 0 - nodeShapeProperties.size / 2;
                    return Translate(diff, diff);
                })
                .attr('height', nodeShapeProperties.size)
                .attr('width', nodeShapeProperties.size)
                .attr('stroke', nodeShapeProperties.stroke)
                .attr('stroke-width', nodeShapeProperties.strokeWidth);
        }

        this.nodesEnter.attr('fill', (d: any) => {
                return d._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
            })
            .on('click', click);
        this.nodesEnter.append('title')
            .text((d: any) => {
                return d.data.name;
            });
    
        if (nodeShapeProperties.animation) {
            this.nodesEnter.attr('opacity', 0)
                .transition()
                .duration(nodeShapeProperties.animationDuration)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 1);

            this.nodes.transition()
                .duration(nodeShapeProperties.animationDuration)
                .attr('transform', (node: HierarchyPointNode<any>) => {
                    return Translate(node.x, node.y);
                })
                .attr('fill', (node: any) => {
                    return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
                });

            this.nodes.exit()
                .attr('opacity', 1)
                .transition()
                .duration(nodeShapeProperties.animationDuration)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 0)
                .remove();
        } else {
            this.nodesEnter.attr('opacity', 1);

            this.nodes.attr('transform', (d: HierarchyPointNode<any>) => {
                    return Translate(d.x, d.y);
                });

            this.nodes.exit().remove();
        }
    }

    private _centerNode(node: HierarchyPointNode<any>) {
        let t = zoomTransform(this.rootSVG.node() as Element);
        let x = -node.x;
        let y = -node.y;
        x = x * t.k + this.treeProperties.generalProperties.containerWidth / 2;
        y = y * t.k + this.treeProperties.generalProperties.containerHeight / 2;
        this.rootSVG.transition().duration(1000).call( this.rootSVGZoomListner.transform as any, zoomIdentity.translate(x,y).scale(t.k) );
    }

    private _createNodeText() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        let nodeTextEnter = this.nodesEnter.append('g')
            .classed('nodeText', true);
        
        nodeTextEnter.append('text')
            .attr('fill', nodeTextProperties.foregroundColor)
            .style('dominant-baseline', 'middle')
            .style('font-size', nodeTextProperties.fontSize)
            .style('font-family', nodeTextProperties.fontFamily)
            .style('font-weight', nodeTextProperties.fontWeight)
            .style('font-style', nodeTextProperties.fontStyle);

        if (generalProperties.orientation == TreeOrientation.vertical) {
            this._createNodeTextForVerticalTree(nodeTextEnter);
        } else {
            this._createNodeTextForHorizontalTree(nodeTextEnter);
        }

        nodeTextEnter.append('title')
        .text((d: any) => {
            return d.data.name;
        });

        if (nodeTextProperties.showBackground) {
            this.nodesEnter.selectAll('g.nodeText')
                .insert('rect', 'text')
                .each((d, i, elements) => {
                    let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
                    select(elements[i])
                        .attr('x', svgRect.x - nodeTextProperties.textPadding / 2)
                        .attr('y', svgRect.y - nodeTextProperties.textPadding / 2)
                        .attr('height', svgRect.height + nodeTextProperties.textPadding)
                        .attr('width', svgRect.width + nodeTextProperties.textPadding)
                        .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
                });
        }
    }

    private _createNodeTextForHorizontalTree(nodeTextEnter: Selection<BaseType, HierarchyPointNode<any>, BaseType, any>) {

        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        nodeTextEnter.selectAll('text')
            .attr('x', (d: HierarchyPointNode<any>) => {
                if (d.children) {
                    return -this.nodeShapeSize - nodeTextProperties.spaceBetweenNodeAndText;
                } else {
                    return this.nodeShapeSize + nodeTextProperties.spaceBetweenNodeAndText;
                }
            })
            .style('text-anchor', (d: HierarchyPointNode<any>) => {
                let textAnchor = d.children ? 'end': 'start';
                return textAnchor;
            })
            .text((d: any) => {
                return d.data.name;
            });
        
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
    }

    private _createNodeTextForVerticalTree(nodeTextEnter: Selection<BaseType, HierarchyPointNode<any>, BaseType, any>) {

        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        let textProperties: TextProperties = {
            'fontFamily': nodeTextProperties.fontFamily,
            'fontSize': nodeTextProperties.fontSize
        };
        
        let maxAllowedTextwidth = nodeTextProperties.maxAllowedWidth - (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);
        nodeTextEnter.selectAll('text')
            .attr('y', (node: HierarchyPointNode<any>) => {
                let totalSpacing = 0;
                let backgroundSpacing = nodeTextProperties.showBackground ? nodeTextProperties.textPadding / 2: 0;
                if (node.children) {
                    totalSpacing = -this.nodeShapeSize - nodeTextProperties.spaceBetweenNodeAndText - backgroundSpacing;
                } else {
                    totalSpacing = this.nodeShapeSize + nodeTextProperties.spaceBetweenNodeAndText * 2 + backgroundSpacing;
                }
                return totalSpacing;
            })
            .style('text-anchor', 'middle')
            .text((node: any) => {
                textProperties.text = node.data.name;
                return GetTailoredTextOrDefault(textProperties, maxAllowedTextwidth);
            });

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
    }

    private _createNodeLinks() {

        let nodeLinkProperties: TreeNodeLinkProperties = this.treeProperties.nodeLinkProperties;
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeAnimationDuration: number = this.treeProperties.nodeShapeProperties.animationDuration;

        let horizontalCurveLink = linkHorizontal()
            .x(function(d: any) { return d.x; })
            .y(function(d: any) { return d.y; });
        let verticalCurveLink = linkVertical()
            .x(function(d: any) { return d.x; })
            .y(function(d: any) { return d.y; });

        let straightLink = (source: any, target: any) => {
            return "M" + source.x + "," + source.y +
                "L" + target.x + "," + target.y;
        }

        let horizontalSquareLink = (source: any, target: any) => {
            return "M" + source.x + "," + source.y +
                "H" + (source.x + 15) +  // TODO: change +15
                "V" + target.y +
                "H" + target.x;
        }
        let verticalSquareLink = (source: any, target: any) => {
            return "M" + source.x + "," + source.y +
                "V" + (source.y + 15) +  // TODO: change +15
                "H" + target.x +
                "V" + target.y;
        }

        let createPath = (d: any) => {
            if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.curved) {
                if (generalProperties.orientation == TreeOrientation.horizontal) {
                    return horizontalCurveLink(d) as any
                } else {
                    return verticalCurveLink(d) as any
                }
            } else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.straight) {
                return straightLink(d.source, d.target);
            } else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.corner) {
                if (generalProperties.orientation == TreeOrientation.horizontal) {
                    return horizontalSquareLink(d.source, d.target);
                } else {
                    return verticalSquareLink(d.source, d.target);
                }
            }
        }

        let nodeLinks: d3.Selection<d3.BaseType, any, any, any> = this.treeGroup.selectAll('path.link')
            .data(this.treeDataLinks, (d: any) => {
                return (d.source.data.name + d.target.data.name + d.source.x + d.target.y);
            });
            
        let nodeLinksEnter = nodeLinks.enter()
            .insert("path", "g")   //will insert path before g elements
            .classed('link', true)
            .attr('fill', 'none')
            .attr('stroke', nodeLinkProperties.stroke)
            .attr('stroke-width', nodeLinkProperties.strokeWidth)
            .attr('d', createPath);

        nodeLinksEnter.append('title')
            .text((d: any) => {
                return d.source.data.name + " -> " + d.target.data.name;
            });


        if (nodeLinkProperties.animation) {
            nodeLinksEnter.each((d, i, elements) => {
                let linkLength = (elements[i] as any).getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", linkLength)
                    .transition()
                    .delay(nodeAnimationDuration - (nodeAnimationDuration / 3))
                    .duration(nodeLinkProperties.animationDuration)
                    // .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", 0);
            });

            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .transition()
                .duration(nodeLinkProperties.animationDuration)
                .attr('d', createPath);

            nodeLinks.exit()
                .each((d, i, elements) => {
                    let linkLength = (elements[i] as any).getTotalLength();
                    select(elements[i])
                        .attr('stroke-dasharray', linkLength + " " + linkLength)
                        .attr("stroke-dashoffset", 0)
                        .attr('opacity', 1)
                        .transition()
                        .duration(nodeLinkProperties.animationDuration)
                        // .ease(d3_ease.easeCubicIn)
                        .attr("stroke-dashoffset", linkLength)
                        .attr('opacity', 0)
                        .remove();
                });
        } else {
            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .attr('d', createPath);

            nodeLinks.exit().remove();
        }
    }
}
