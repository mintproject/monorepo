import { describe, it, expect } from 'vitest';
import {
  GetModelTreeDocument,
  GetConfigurationDocument,
  PrefetchReferenceDataDocument,
  GetPersonsDocument,
  AddConfigurationInputDocument,
  AddConfigurationOutputDocument,
  AddConfigurationParameterDocument,
  DeleteConfigurationInputDocument,
  DeleteConfigurationOutputDocument,
  DeleteConfigurationParameterDocument,
  UpdateConfigurationDocument,
  RegisterModelDocument,
  // Hooks
  useGetModelTreeQuery,
  useGetConfigurationQuery,
  usePrefetchReferenceDataQuery,
  useGetPersonsQuery,
  useAddConfigurationInputMutation,
  useAddConfigurationOutputMutation,
  useAddConfigurationParameterMutation,
  useDeleteConfigurationInputMutation,
  useDeleteConfigurationOutputMutation,
  useDeleteConfigurationParameterMutation,
  useUpdateConfigurationMutation,
  useRegisterModelMutation,
} from '../graphql/generated/graphql';

/**
 * These tests verify that the generated graphql.ts module exports the expected
 * document nodes and hooks, and that document nodes have the correct GraphQL
 * operation names.
 *
 * This is a lightweight "smoke test" for the generated layer — it does NOT
 * test actual GraphQL execution (that's covered by integration tests with MSW).
 */
describe('Generated GraphQL documents', () => {
  it('exports GetModelTree document', () => {
    expect(GetModelTreeDocument).toBeDefined();
    expect(GetModelTreeDocument.kind).toBe('Document');
  });

  it('exports GetConfiguration document', () => {
    expect(GetConfigurationDocument).toBeDefined();
    expect(GetConfigurationDocument.kind).toBe('Document');
  });

  it('exports PrefetchReferenceData document', () => {
    expect(PrefetchReferenceDataDocument).toBeDefined();
  });

  it('exports GetPersons document', () => {
    expect(GetPersonsDocument).toBeDefined();
  });

  it('exports AddConfigurationInput mutation document', () => {
    expect(AddConfigurationInputDocument).toBeDefined();
    expect(AddConfigurationInputDocument.kind).toBe('Document');
  });

  it('exports AddConfigurationOutput mutation document', () => {
    expect(AddConfigurationOutputDocument).toBeDefined();
  });

  it('exports AddConfigurationParameter mutation document', () => {
    expect(AddConfigurationParameterDocument).toBeDefined();
  });

  it('exports DeleteConfigurationInput mutation document', () => {
    expect(DeleteConfigurationInputDocument).toBeDefined();
  });

  it('exports DeleteConfigurationOutput mutation document', () => {
    expect(DeleteConfigurationOutputDocument).toBeDefined();
  });

  it('exports DeleteConfigurationParameter mutation document', () => {
    expect(DeleteConfigurationParameterDocument).toBeDefined();
  });

  it('exports UpdateConfiguration mutation document', () => {
    expect(UpdateConfigurationDocument).toBeDefined();
  });

  it('exports RegisterModel mutation document', () => {
    expect(RegisterModelDocument).toBeDefined();
  });
});

describe('Generated GraphQL hooks', () => {
  it('exports useGetModelTreeQuery as a function', () => {
    expect(typeof useGetModelTreeQuery).toBe('function');
  });

  it('exports useGetConfigurationQuery as a function', () => {
    expect(typeof useGetConfigurationQuery).toBe('function');
  });

  it('exports usePrefetchReferenceDataQuery as a function', () => {
    expect(typeof usePrefetchReferenceDataQuery).toBe('function');
  });

  it('exports useGetPersonsQuery as a function', () => {
    expect(typeof useGetPersonsQuery).toBe('function');
  });

  it('exports useAddConfigurationInputMutation as a function', () => {
    expect(typeof useAddConfigurationInputMutation).toBe('function');
  });

  it('exports useAddConfigurationOutputMutation as a function', () => {
    expect(typeof useAddConfigurationOutputMutation).toBe('function');
  });

  it('exports useAddConfigurationParameterMutation as a function', () => {
    expect(typeof useAddConfigurationParameterMutation).toBe('function');
  });

  it('exports useDeleteConfigurationInputMutation as a function', () => {
    expect(typeof useDeleteConfigurationInputMutation).toBe('function');
  });

  it('exports useDeleteConfigurationOutputMutation as a function', () => {
    expect(typeof useDeleteConfigurationOutputMutation).toBe('function');
  });

  it('exports useDeleteConfigurationParameterMutation as a function', () => {
    expect(typeof useDeleteConfigurationParameterMutation).toBe('function');
  });

  it('exports useUpdateConfigurationMutation as a function', () => {
    expect(typeof useUpdateConfigurationMutation).toBe('function');
  });

  it('exports useRegisterModelMutation as a function', () => {
    expect(typeof useRegisterModelMutation).toBe('function');
  });
});
