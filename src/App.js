// @flow

import React, { Component } from "react";
import GraphiQL from "graphiql";
import GraphiQLExplorer from "graphiql-explorer";
import CodeExporter from "graphiql-code-exporter";
import codeExporterDefaultSnippets from "graphiql-code-exporter/lib/snippets";
import { buildClientSchema, getIntrospectionQuery, parse } from "graphql";

import { makeDefaultArg, getDefaultScalarArgValue } from "./CustomArgs";

import "graphiql/graphiql.css";
import "graphiql-code-exporter/CodeExporter.css";
import "./App.css";

import type { GraphQLSchema } from "graphql";

const APP_ID = "1b2b8f9d-f2de-49a7-b5d6-46c313ddc203";

const serverUrl = `https://serve.onegraph.com/dynamic?app_id=${APP_ID}`;

function fetcher(params: Object): Object {
  return fetch(serverUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  }).then(function(response) {
    return response.text();
  }).then(function(responseBody) {
    try {
      return JSON.parse(responseBody);
    } catch (e) {
      return responseBody;
    }
  });
}

const DEFAULT_QUERY = `# shift-option/alt-click on a query below to jump to it in the explorer
# option/alt-click on a field in the explorer to select all subfields

query npmPackage($name: String! = "graphql") {
  npm {
    package(name: $name) {
      name
      homepage
      downloads {
        lastMonth {
          count
        }
      }
    }
  }
}

fragment bundlephobiaInfo on BundlephobiaDependencyInfo {
  name
  size
  version
  history {
    dependencyCount
    size
    gzip
  }
}`;

const DEFAULT_VARIABLES = '{"name": "prisma"}';

type State = {
  schema: ?GraphQLSchema,
  query: string,
  explorerIsOpen: boolean,
  codeExporterIsOpen: boolean,
  variables: string, // Will be the raw text input from GraphiQL's `variables` pane
};

class App extends Component<{}, State> {
  _graphiql: GraphiQL;

  state = {
    schema: null,
    query: DEFAULT_QUERY,
    explorerIsOpen: true,
    codeExporterIsOpen: true,
    variables: DEFAULT_VARIABLES,
  };

  componentDidMount() {
    fetcher({
      query: getIntrospectionQuery()
    }).then(result => {
      const editor = this._graphiql.getQueryEditor();
      editor.setOption("extraKeys", {
        ...(editor.options.extraKeys || {}),
        "Shift-Alt-LeftClick": this._handleInspectOperation
      });

      this.setState({ schema: buildClientSchema(result.data) });
    });
  }

  _handleInspectOperation = (
    cm: any,
    mousePos: { line: Number, ch: Number }
  ) => {
    const parsedQuery = parse(this.state.query || "");

    if (!parsedQuery) {
      console.error("Couldn't parse query document");
      return null;
    }

    var token = cm.getTokenAt(mousePos);
    var start = { line: mousePos.line, ch: token.start };
    var end = { line: mousePos.line, ch: token.end };
    var relevantMousePos = {
      start: cm.indexFromPos(start),
      end: cm.indexFromPos(end)
    };

    var position = relevantMousePos;

    var def = parsedQuery.definitions.find(definition => {
      if (!definition.loc) {
        console.log("Missing location information for definition");
        return false;
      }

      const { start, end } = definition.loc;
      return start <= position.start && end >= position.end;
    });

    if (!def) {
      console.error(
        "Unable to find definition corresponding to mouse position"
      );
      return null;
    }

    var operationKind =
      def.kind === "OperationDefinition"
        ? def.operation
        : def.kind === "FragmentDefinition"
        ? "fragment"
        : "unknown";

    var operationName =
      def.kind === "OperationDefinition" && !!def.name
        ? def.name.value
        : def.kind === "FragmentDefinition" && !!def.name
        ? def.name.value
        : "unknown";

    var selector = `.graphiql-explorer-root #${operationKind}-${operationName}`;

    var el = document.querySelector(selector);
    el && el.scrollIntoView();
  };

  _handleEditQuery = (query: string): void => this.setState({ query });

  _handleToggleExplorer = () => {
    this.setState({ explorerIsOpen: !this.state.explorerIsOpen });
  };

  _handleToggleCodeExporter = () =>
    this.setState({
      codeExporterIsOpen: !this.state.codeExporterIsOpen,
    });

  _handleEditVariables = (variables: string) => {
    this.setState({variables});
  };

  render() {
    const { query, schema, variables } = this.state;

    const codeExporter = this.state.codeExporterIsOpen ? (
      <CodeExporter
        hideCodeExporter={this._handleToggleCodeExporter}
        snippets={codeExporterDefaultSnippets}
        serverUrl={serverUrl}
        context={{
          appId: APP_ID,
        }}
        variables={variables}
        headers={{}}
        query={query}
        // Optional if you want to use a custom theme
        codeMirrorTheme="neo"
      />
    ) : null;

    return (
      <div className="graphiql-container">
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this._handleEditQuery}
          onRunOperation={operationName =>
            this._graphiql.handleRunQuery(operationName)
          }
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this._handleToggleExplorer}
          getDefaultScalarArgValue={getDefaultScalarArgValue}
          makeDefaultArg={makeDefaultArg}
        />
        <GraphiQL
          ref={ref => (this._graphiql = ref)}
          fetcher={fetcher}
          schema={schema}
          query={query}
          variables={variables}
          onEditQuery={this._handleEditQuery}
          onEditVariables={this._handleEditVariables}>
          <GraphiQL.Toolbar>
            <GraphiQL.Button
              onClick={() => this._graphiql.handlePrettifyQuery()}
              label="Prettify"
              title="Prettify Query (Shift-Ctrl-P)"
            />
            <GraphiQL.Button
              onClick={() => this._graphiql.handleToggleHistory()}
              label="History"
              title="Show History"
            />
            <GraphiQL.Button
              onClick={this._handleToggleExplorer}
              label="Explorer"
              title="Toggle Explorer"
            />
            <GraphiQL.Button
              onClick={this._handleToggleCodeExporter}
              label="Code Exporter"
              title="Toggle Code Exporter"
            />
          </GraphiQL.Toolbar>
        </GraphiQL>
        {codeExporter}
      </div>
    );
  }
}

export default App;
