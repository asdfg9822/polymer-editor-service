/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Property, ScannedProperty, SourcePosition} from 'polymer-analyzer';
import {CssCustomPropertyAssignment, CssCustomPropertyUse} from 'polymer-analyzer/lib/css/css-custom-property-scanner';
import {Hover, IConnection} from 'vscode-languageserver';
import {TextDocumentPositionParams} from 'vscode-languageserver-protocol';

import AnalyzerLSPConverter from './converter';
import FeatureFinder, {DatabindingFeature} from './feature-finder';
import {Logger} from './logger';
import {Handler} from './util';

/**
 * Gets documentation for tooltips (i.e. docmentation-on-hover)
 */
export default class HoverDocumenter extends Handler {
  constructor(
      protected connection: IConnection,
      private converter: AnalyzerLSPConverter,
      private featureFinder: FeatureFinder, private readonly logger: Logger) {
    super();

    this.connection.onHover(async(textPosition) => {
      logger.log(`Hover request: ${textPosition.position.line}:${textPosition
                     .position.character} in ${textPosition.textDocument}`);
      return await this.handleErrors(
          this.getDocsForHover(textPosition), undefined);
    });
  }

  private async getDocsForHover(textPosition: TextDocumentPositionParams):
      Promise<Hover|undefined> {
    const localPath =
        this.converter.getWorkspacePathToFile(textPosition.textDocument);
    const documentation = await this.getDocumentationAndRangeAtPosition(
        localPath, this.converter.convertPosition(textPosition.position));
    if (!documentation) {
      return;
    }
    let result: Hover = {contents: documentation.contents, range: undefined};
    if (documentation.range) {
      result.range = this.converter.convertPRangeToL(documentation.range);
    }
    return result;
  }

  private async getDocumentationAndRangeAtPosition(
      localPath: string, position: SourcePosition) {
    const location = await this.featureFinder.getAstLocationAtPositionAndPath(
        localPath, position);
    if (!location) {
      this.logger.log(`No location`);
      return;
    }
    const featureResult =
        this.featureFinder.getFeatureForAstLocation(location, position);
    if (!featureResult) {
      this.logger.log(`No feature`);
      return;
    }
    const {feature} = featureResult;
    if (feature instanceof CssCustomPropertyAssignment ||
        feature instanceof CssCustomPropertyUse) {
      return;
    }
    if (feature instanceof DatabindingFeature) {
      const property = feature.property;
      if (property && property.description) {
        return {contents: property.description!, range: feature.propertyRange};
      }
      return;
    }
    let description = feature.description;
    if (isProperty(feature)) {
      if (feature.type) {
        description = `{${feature.type}} ${feature.description}`;
      }
    }
    if (!description) {
      return;
    }
    this.logger.log(`Found hover description: ${description}`);
    // TODO(rictic): we can get ranges more often here. The tricky thing is
    // that we want the location of the area we're mousing over, which usually
    // isn't `feature`. We want the range of the referencer, not the referent.
    return {contents: description, range: undefined};
  }
}

function isProperty(d: any): d is(ScannedProperty | Property) {
  return 'type' in d;
}
