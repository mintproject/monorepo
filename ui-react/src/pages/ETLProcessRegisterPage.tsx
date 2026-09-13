import * as React from 'react';
import { gql, useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  StandardVariableCombobox,
  type StandardVariableOption,
} from '@/components/autocomplete/StandardVariableCombobox';
import { generateMintUri } from '@/lib/uri';

const CREATE_ETL = gql`
  mutation CreateETL($object: modelcatalog_etl_process_insert_input!) {
    insert_modelcatalog_etl_process_one(object: $object) {
      id
      label
    }
  }
`;

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

export function ETLProcessRegisterPage() {
  const [create] = useMutation(CREATE_ETL);
  const [runtime, setRuntime] = React.useState('tapis_function');
  const [message, setMessage] = React.useState<string | null>(null);
  const [source, setSource] = React.useState(
    'def transform(input_path, output_path):\n    return output_path',
  );
  const [inputVariable, setInputVariable] = React.useState<StandardVariableOption | null>(null);
  const [outputVariable, setOutputVariable] = React.useState<StandardVariableOption | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get('id') || generateMintUri());
    const contract = (role: 'input' | 'output', position: number) => ({
      etl_process_id: id,
      role,
      position,
      standard_variable_uri: (role === 'input' ? inputVariable?.id : outputVariable?.id) || '',
      unit: String(form.get(`${role}-unit`) || '') || null,
      format: String(form.get(`${role}-format`) || '') || null,
    });
    try {
      await create({
        variables: {
          object: {
            id,
            label: form.get('label'),
            description: form.get('description'),
            version: form.get('version'),
            visibility: form.get('visibility'),
            runtime_kind: runtime,
            runtime_json: {
              language: 'python',
              entrypoint: form.get('entrypoint'),
              source: { language: 'python', code: source },
              tapis_app_id: form.get('app_id') || null,
              tapis_app_version: form.get('app_version') || null,
            },
            contracts: { data: [contract('input', 0), contract('output', 0)] },
          },
        },
      });
      setMessage('ETL process registered in the MINT catalog.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Registration failed');
    }
  };
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Register</h1>
        <p className="text-muted-foreground">
          Register a reusable ETL process in the MINT catalog.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>ETL process</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="id">Stable ID</Label>
                <Input id="id" name="id" placeholder="head-m-to-ft" />
                <FieldHelp>
                  Optional permanent identifier used to reference this process in workflows and
                  other projects.
                </FieldHelp>
              </div>
              <div>
                <Label htmlFor="label">Name</Label>
                <Input id="label" name="label" required />
                <FieldHelp>
                  Use a name a scientist can recognize, such as “Convert water level from meters to
                  feet.”
                </FieldHelp>
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Input id="version" name="version" defaultValue="1.0.0" />
                <FieldHelp>
                  Increase this when the code or SVO meaning changes so existing workflows remain
                  reproducible.
                </FieldHelp>
              </div>
              <div>
                <Label htmlFor="visibility">Visibility</Label>
                <select
                  id="visibility"
                  name="visibility"
                  className="mt-1 block w-full rounded border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="private"
                >
                  <option>private</option>
                  <option>shared</option>
                  <option>public</option>
                </select>
                <FieldHelp>
                  Private is visible only to you; shared lets collaborators use it; public makes it
                  broadly discoverable.
                </FieldHelp>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
              <FieldHelp>
                Explain what the process does, what data it expects, and what it produces. This is
                shown in the catalog.
              </FieldHelp>
            </div>
            <div>
              <Label htmlFor="runtime">Runtime</Label>
              <select
                id="runtime"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                className="mt-1 block w-full rounded border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="tapis_function">Inline Tapis function</option>
                <option value="tapis_app">Tapis app/job</option>
              </select>
              <FieldHelp>
                Choose an inline Python function for a small reusable step. Choose a Tapis app when
                the process needs a registered container, files, or substantial compute.
              </FieldHelp>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="entrypoint">Python entrypoint</Label>
                <Input id="entrypoint" name="entrypoint" defaultValue="transform" />
                <FieldHelp>
                  The function name the workflow calls in your Python source, for example{' '}
                  <code>transform</code>.
                </FieldHelp>
              </div>
              <div>
                <Label htmlFor="app_id">Tapis app ID</Label>
                <Input id="app_id" name="app_id" />
                <FieldHelp>
                  For a Tapis app, enter its registered ID. Leave blank for an inline function.
                </FieldHelp>
              </div>
              <div>
                <Label htmlFor="app_version">Tapis app version</Label>
                <Input id="app_version" name="app_version" />
                <FieldHelp>
                  Pin the app version used by workflows so results can be reproduced.
                </FieldHelp>
              </div>
            </div>
            <div>
              <Label htmlFor="source">Python source</Label>
              <Textarea
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
              <FieldHelp>
                Write the small transformation here. It is stored as catalog metadata and executed
                only by the configured Tapis workflow runtime.
              </FieldHelp>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Input contract</legend>
                <StandardVariableCombobox
                  value={inputVariable}
                  onChange={setInputVariable}
                  placeholder="Choose input SVO variable"
                />
                <FieldHelp>
                  Select the SVO variable this process consumes. The adapter uses it to find
                  compatible upstream data and connect workflow steps.
                </FieldHelp>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <Input name="input-unit" placeholder="Unit" />
                    <FieldHelp>Expected measurement unit, if relevant.</FieldHelp>
                  </div>
                  <div>
                    <Input name="input-format" placeholder="Format" />
                    <FieldHelp>File or data format, such as CSV or NetCDF.</FieldHelp>
                  </div>
                </div>
              </fieldset>
              <fieldset className="rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Output contract</legend>
                <StandardVariableCombobox
                  value={outputVariable}
                  onChange={setOutputVariable}
                  placeholder="Choose output SVO variable"
                />
                <FieldHelp>
                  Select the SVO variable this process creates. This output becomes discoverable as
                  the next step’s input.
                </FieldHelp>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <Input name="output-unit" placeholder="Unit" />
                    <FieldHelp>Produced measurement unit, if relevant.</FieldHelp>
                  </div>
                  <div>
                    <Input name="output-format" placeholder="Format" />
                    <FieldHelp>Produced file or data format.</FieldHelp>
                  </div>
                </div>
              </fieldset>
            </div>
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit">Register ETL process</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
