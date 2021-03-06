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

import {assert} from 'chai';
import * as path from 'path';
import {ResolvedUrl} from 'polymer-analyzer/lib/model/url';

import {createTestEnvironment} from './util';

const fixtureDir = path.join(__dirname, '..', '..', 'src', 'test', 'static');

suite('HoverDocumenter', function() {
  const indexFile = path.join('editor-service', 'index.html');
  const tagPosition = {line: 7, column: 9};
  const localAttributePosition = {line: 7, column: 31};
  const deepAttributePosition = {line: 7, column: 49};

  const tagDescription = 'An element to test out behavior inheritance.';
  const localAttributeDescription =
      '{boolean} A property defined directly on behavior-test-elem.';
  const deepAttributeDescription =
      '{Array} This is a deeply inherited property.';

  let testName = 'it supports getting the element description ' +
      'when asking for docs at its tag name';

  test(testName, async() => {
    const {client} = await createTestEnvironment(fixtureDir);

    assert.deepEqual(
        await client.getHover('editor-service/index.html', tagPosition),
        {contents: tagDescription});
  });

  testName = 'it can still get element info after changing a file in memory';
  test(testName, async() => {
    const {client, server} = await createTestEnvironment(fixtureDir);

    const contents =
        await server.fileSynchronizer.urlLoader.load(indexFile as ResolvedUrl);

    // Add a newline at the beginning of the file, shifting the lines
    // down.
    await client.openFile(indexFile, `\n${contents}`);
    await server.fileSynchronizer.fileChanges.next;

    assert.deepEqual(await client.getHover(indexFile, tagPosition), null);
    assert.deepEqual(
        await client.getHover(
            indexFile,
            {line: tagPosition.line + 1, column: tagPosition.column}),
        {contents: tagDescription});
  });

  test('it supports getting an attribute description', async() => {
    const {client} = await createTestEnvironment(fixtureDir);
    assert.deepEqual(
        await client.getHover(indexFile, localAttributePosition),
        {contents: localAttributeDescription});
  });

  testName = 'it supports getting a description of an attribute ' +
      'defined in a behavior';
  test(testName, async() => {
    const {client} = await createTestEnvironment(fixtureDir);
    assert.deepEqual(
        await client.getHover(indexFile, deepAttributePosition),
        {contents: deepAttributeDescription});
  });

  const fooPropUsePosition = {line: 2, column: 16};
  const internalPropUsePosition = {line: 3, column: 12};
  test(`Give documentation for properties in databindings.`, async() => {
    const {client, underliner} = await createTestEnvironment(fixtureDir);

    const path = 'polymer/element-with-databinding.html';
    const uri = client.converter.getUriForLocalPath(path);
    let hover = (await client.getHover(path, fooPropUsePosition))!;
    assert.deepEqual(hover.contents, 'This is the foo property.');
    assert.deepEqual(await underliner.underline({range: hover.range!, uri}), `
    <div id="{{foo}}"></div>
               ~~~`);

    hover = (await client.getHover(
        'polymer/element-with-databinding.html', internalPropUsePosition))!;
    assert.deepEqual(hover.contents, 'A private internal prop.');
    assert.deepEqual(await underliner.underline({range: hover.range!, uri}), `
    {{_internal}}
      ~~~~~~~~~`);
  });
});
